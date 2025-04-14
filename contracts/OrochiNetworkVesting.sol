// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OrochiNetworkToken.sol";

error UnableToRelease(address account, uint64 milestone, uint256 amount);
error VestingWasNotStarted(address account, uint64 timestamp, uint64 start);
error NoClaimableToken(address account, uint64 milestone);
error InsufficientBalance(address account, uint256 amount, uint256 remaining);
error InvalidVestingTerm();
error UnableToDistributeToken(address beneficiary, uint256 amount);
error UnableToAirdropToken(address beneficiary, uint256 amount);
error BeneficiaryAmountMismatch(uint256 beneficaries, uint256 amounts);
error TGENotStarted();
error TGEAlreadyStarted();

/**
 * @title Orochi Network Token
 */
contract OrochiNetworkVesting is ReentrancyGuard, Ownable {
    struct VestingTerm {
        address beneficiary;
        uint64 start;
        uint64 end;
        uint64 duration;
        uint256 unlocked;
        uint256 total;
    }

    struct VestingSchedule {
        uint64 start;
        uint64 end;
        uint64 duration;
        uint64 milestonClaimed;
        uint256 milestoneRelease;
        uint256 remaining;
        uint256 total;
    }

    OrochiNetworkToken token;

    mapping(address => VestingSchedule) private schedule;

    mapping(address => uint256) private airdrop;

    bool private isPostTGE = false;

    event TokenClaimed(address account, uint64 milestone, uint256 amount);
    event UnlockAtTGE(address account, uint256 amount);
    event AirdropClaim(address account, uint256 amount);
    event TGEStarted();

    modifier onlyPostTGE() {
        if (isPostTGE) {
            revert TGENotStarted();
        }
        _;
    }

    modifier onlyPreTGE() {
        if (!isPostTGE) {
            revert TGEAlreadyStarted();
        }
        _;
    }

    /*******************************************************
     * Constructor
     ********************************************************/

    constructor(address tokenAddress) {
        token = OrochiNetworkToken(tokenAddress);
    }

    /*******************************************************
     * External Post TGE
     ********************************************************/
    function claim() external nonReentrant onlyPostTGE {
        _claim(msg.sender);
    }

    function claimAirdrop() external nonReentrant onlyPostTGE {
        if (airdrop[msg.sender] > 0) {
            if (!token.mint(msg.sender, airdrop[msg.sender])) {
                revert UnableToAirdropToken(msg.sender, airdrop[msg.sender]);
            }
            emit AirdropClaim(msg.sender, airdrop[msg.sender]);
            airdrop[msg.sender] = 0;
        }
    }

    /*******************************************************
     * Owner Pre TGE
     ********************************************************/

    /**
     * Starts the TGE and sets isPostTGE to true.
     * This mean some pre TGE action will be locked
     * @dev Only callable by the owner before pre-TGE. Emits TGEStarted event.
     */
    function startTGE() external nonReentrant onlyOwner onlyPreTGE {
        isPostTGE = true;
        emit TGEStarted();
    }

    function addUserToAirdrop(
        address[] memory beneficaries,
        uint256[] memory amounts
    ) external nonReentrant onlyOwner onlyPreTGE {
        if (beneficaries.length != amounts.length) {
            revert BeneficiaryAmountMismatch(
                beneficaries.length,
                amounts.length
            );
        }
        for (uint256 i = 0; i < beneficaries.length; i += 1) {
            airdrop[beneficaries[i]] += amounts[i];
        }
    }

    function addVestingTerm(
        VestingTerm calldata term
    ) external onlyOwner nonReentrant onlyPreTGE {
        uint256 remaining = term.total - term.unlocked;
        uint256 milestoneTotal = (term.start - term.end) / term.duration;

        if (
            term.start < block.timestamp ||
            term.end < (term.start + term.duration) ||
            remaining <= 0 ||
            milestoneTotal <= 0
        ) {
            revert InvalidVestingTerm();
        }

        if (term.unlocked > 0 && !token.mint(term.beneficiary, term.unlocked)) {
            revert UnableToDistributeToken(term.beneficiary, term.unlocked);
        }

        if (term.unlocked > 0) {
            emit UnlockAtTGE(term.beneficiary, term.unlocked);
        }

        schedule[term.beneficiary] = VestingSchedule({
            start: term.start,
            end: term.end,
            duration: term.duration,
            milestonClaimed: 0,
            milestoneRelease: remaining / milestoneTotal,
            remaining: remaining,
            total: term.total
        });
    }

    /*******************************************************
     * Owner TGE
     ********************************************************/

    function claimHelper(
        address[] memory accounts
    ) external nonReentrant onlyOwner onlyPostTGE {
        for (uint i = 0; i < accounts.length; i += 1) {
            _claim(accounts[i]);
        }
    }

    /*******************************************************
     * Internal
     ********************************************************/

    function _claim(address account) internal {
        VestingSchedule memory vestingSchedule = schedule[account];
        // Check if the vesting has started
        if (block.timestamp < vestingSchedule.start) {
            revert VestingWasNotStarted(
                account,
                uint64(block.timestamp),
                vestingSchedule.start
            );
        }

        (uint64 milestone, uint256 amount) = _balance(account);

        // Check if there is any claimable token left
        if (milestone == 0) {
            revert NoClaimableToken(account, milestone);
        }

        if (amount > vestingSchedule.remaining) {
            revert InsufficientBalance(
                account,
                amount,
                vestingSchedule.remaining
            );
        }

        // Update the vesting schedule
        vestingSchedule.milestonClaimed = milestone;
        vestingSchedule.remaining -= amount;
        schedule[account] = vestingSchedule;

        if (!token.mint(account, amount)) {
            revert UnableToRelease(account, milestone, amount);
        }

        emit TokenClaimed(account, milestone, amount);
    }

    /*******************************************************
     * External View
     ********************************************************/

    function balance(address account) external view returns (uint256) {
        (, uint256 amount) = _balance(account);
        return amount;
    }

    function balanceAirdrop(address account) external view returns (uint256) {
        return airdrop[account];
    }

    function isTGEStarted() external view returns (bool) {
        return isPostTGE;
    }

    function getVestingSchedule(
        address account
    ) external view returns (VestingSchedule memory) {
        return schedule[account];
    }

    /*******************************************************
     * Internal View
     ********************************************************/
    function _balance(
        address account
    ) internal view returns (uint64 milestone, uint256 amount) {
        VestingSchedule memory vestingSchedule = schedule[account];
        if (block.timestamp < vestingSchedule.start) {
            return (0, 0);
        }

        milestone =
            ((uint64(block.timestamp) - vestingSchedule.start) /
                vestingSchedule.duration) -
            vestingSchedule.milestonClaimed;
        return (milestone, milestone * vestingSchedule.milestoneRelease);
    }
}
