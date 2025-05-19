// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IOrochiNetworkToken.sol";

error UnableToRelease(address account, uint64 milestone, uint256 amount);
error VestingWasNotStarted(address account, uint64 timestamp, uint64 start);
error NoClaimableToken(address account, uint64 milestone);
error InsufficientBalance(address account, uint256 amount, uint256 remaining);
error InvalidVestingTerm();
error InvalidVestingSchedule(address account);
error UnableToDistributeToken(address beneficiary, uint256 amount);
error UnableToAirdropToken(address beneficiary, uint256 amount);
error BeneficiaryAmountMismatch(uint256 beneficaryList, uint256 amountList);
error BeneficiaryAlreadyAdded(address account);
error TGENotStarted();
error TGEAlreadyStarted();

/**
 * @title Orochi Network Token
 */
contract OrochiNetworkVesting is ReentrancyGuard, Ownable {
    /**
     * @dev Struct to define vesting term
     *
     */
    struct VestingTerm {
        address beneficiary;
        uint64 start;
        uint64 end;
        uint64 duration;
        uint256 unlocked;
        uint256 total;
    }

    /**
     * @dev Struct to store vesting schedule
     */
    struct VestingSchedule {
        uint64 start;
        uint64 end;
        uint64 duration;
        uint64 milestonClaimed;
        uint256 milestoneReleaseAmount;
        uint256 unlocked;
        uint256 totalClaimed;
        uint256 total;
    }

    // Token contract address
    IOrochiNetworkToken token;

    // Schedule of vesting
    mapping(address => VestingSchedule) private schedule;

    // Airdrop map for airdrop recipients
    mapping(address => uint256) private airdrop;

    // Is TGE started or not
    bool private isTGE = false;

    // Event emitted when token is claimed
    event TokenClaimed(address account, uint64 milestone, uint256 amount);

    // Event emitted when token is unlocked at TGE
    event UnlockAtTGE(address account, uint256 amount);

    // Event emitted when airdrop is claimed
    event AirdropClaim(address account, uint256 amount);

    // Event emitted when TGE is started
    event TGEStarted();

    /**
     * @dev Modifier to make sure that the TGE is started
     */
    modifier onlyPostTGE() {
        // It's require isTGE to be true to move one
        if (isTGE == false) {
            revert TGENotStarted();
        }
        _;
    }

    /**
     * @dev Modifier to make sure that the TGE is not started yet
     */
    modifier onlyPreTGE() {
        // It's require isTGE to be false to move one
        if (isTGE == true) {
            revert TGEAlreadyStarted();
        }
        _;
    }

    /*******************************************************
     * Constructor
     ********************************************************/

    /**
     * Constructor
     * @param tokenAddress The address of the token contract
     */
    constructor(address tokenAddress) {
        token = IOrochiNetworkToken(tokenAddress);
    }

    /*******************************************************
     * External Post TGE
     ********************************************************/

    /**
     * Claim tokens for the sender
     * @dev Only callable after TGE
     */
    function claim() external nonReentrant onlyPostTGE {
        _claim(msg.sender);
    }

    /**
     * Claim tokens for the user from airdrop
     * @dev Only callable after TGE
     */
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
     * Starts the TGE and sets isTGE to true.
     * This mean some pre TGE action will be locked
     * @dev Only callable by the owner before TGE. Emits TGEStarted event.
     */
    function startTGE() external nonReentrant onlyOwner onlyPreTGE {
        isTGE = true;
        emit TGEStarted();
    }

    /**
     * Add users to the airdrop pool
     * @dev Only callable by the owner before TGE. Emits TGEStarted event.
     * @param beneficaryList Array of beneficiaries
     * @param amountList Array of amountList
     */
    function addUserToAirdrop(
        address[] memory beneficaryList,
        uint256[] memory amountList
    ) external nonReentrant onlyOwner onlyPreTGE {
        if (beneficaryList.length != amountList.length) {
            revert BeneficiaryAmountMismatch(
                beneficaryList.length,
                amountList.length
            );
        }
        for (uint256 i = 0; i < beneficaryList.length; i += 1) {
            airdrop[beneficaryList[i]] += amountList[i];
        }
    }

    /**
     * Add a vesting term to the contract
     * @dev Only callable by the owner before TGE
     * @param term VestingTerm struct
     */
    function addVestingTerm(
        VestingTerm calldata term
    ) external onlyOwner nonReentrant onlyPreTGE {
        // This schedule isn't empty
        if (schedule[term.beneficiary].total > 0) {
            revert BeneficiaryAlreadyAdded(term.beneficiary);
        }

        // Unlock imediatly if the total amount is already unlocked
        if (term.total == term.unlocked && term.unlocked > 0) {
            uint64 currentTimestamp = uint64(block.timestamp);

            // This schedule vested immediately
            schedule[term.beneficiary] = VestingSchedule({
                start: currentTimestamp,
                end: currentTimestamp,
                duration: 0,
                milestonClaimed: 0,
                milestoneReleaseAmount: 0,
                unlocked: term.total,
                totalClaimed: 0,
                total: term.total
            });

            emit UnlockAtTGE(term.beneficiary, term.unlocked);
            // Prevent program processing further
            return;
        }

        // Filter invalid terms
        if (
            term.total > term.unlocked &&
            term.start > block.timestamp &&
            term.duration > 0 &&
            term.end > (term.start + term.duration)
        ) {
            uint256 remaining = term.total - term.unlocked;
            uint256 milestoneTotal = (term.end - term.start) / term.duration;
            if (milestoneTotal > 0) {
                // Calculate the amount to unlock at TGE
                if (term.unlocked > 0) {
                    emit UnlockAtTGE(term.beneficiary, term.unlocked);
                }

                schedule[term.beneficiary] = VestingSchedule({
                    start: term.start,
                    end: term.end,
                    duration: term.duration,
                    milestonClaimed: 0,
                    milestoneReleaseAmount: remaining / milestoneTotal,
                    unlocked: term.unlocked,
                    totalClaimed: 0,
                    total: term.total
                });
                return;
            }
        }
        revert InvalidVestingTerm();
    }

    /*******************************************************
     * Owner post TGE
     ********************************************************/

    /**
     * Helper to claim tokens for multiple accounts at once
     * @dev Only callable by the owner after TGE
     * @param accounts Array of addresses to claim tokens for
     */
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

    /**
     * Claim tokens for a single account
     * @param account Address of the account to claim tokens for
     */
    function _claim(address account) internal {
        VestingSchedule memory vestingSchedule = schedule[account];

        // If there is no token then vesting schedule is invalid
        if (vestingSchedule.total == 0) {
            revert InvalidVestingSchedule(account);
        }

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
        if (vestingSchedule.totalClaimed > 0 && milestone == 0) {
            revert NoClaimableToken(account, milestone);
        }

        if (
            amount == 0 ||
            amount + vestingSchedule.totalClaimed > vestingSchedule.total
        ) {
            revert InsufficientBalance(
                account,
                amount,
                vestingSchedule.total - vestingSchedule.totalClaimed
            );
        }

        // Update the vesting schedule
        vestingSchedule.milestonClaimed += milestone;
        vestingSchedule.totalClaimed += amount;
        schedule[account] = vestingSchedule;

        if (!token.mint(account, amount)) {
            revert UnableToRelease(account, milestone, amount);
        }

        emit TokenClaimed(account, milestone, amount);
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Claimable token balance of the given account
     * @param account Address of the account
     */
    function balance(address account) external view returns (uint256) {
        (, uint256 amount) = _balance(account);
        return amount;
    }

    /**
     * Balance of airdrop for the given account
     * @param account Address of the account
     */
    function balanceAirdrop(address account) external view returns (uint256) {
        return airdrop[account];
    }

    /**
     * Is TGE started or not
     */
    function isTGEStarted() external view returns (bool) {
        return isTGE;
    }

    /**
     * Get vesting schedule of the given account
     * @param account Address of the account
     */
    function getVestingSchedule(
        address account
    ) external view returns (VestingSchedule memory) {
        return schedule[account];
    }

    /*******************************************************
     * Internal View
     ********************************************************/

    /**
     * Calculate balance of the given account and milestone
     * @param account Address of the account
     * @return milestone Claimable milestone
     * @return amount Claimable amount
     */
    function _balance(
        address account
    ) internal view returns (uint64 milestone, uint256 amount) {
        VestingSchedule memory vestingSchedule = schedule[account];
        if (block.timestamp < vestingSchedule.start) {
            return (0, 0);
        }

        // A specificed case, all token vested immediately
        if (vestingSchedule.unlocked == vestingSchedule.total) {
            return
                vestingSchedule.totalClaimed > 0
                    ? (0, 0)
                    : (0, vestingSchedule.unlocked);
        }

        // Calculate total milestones
        uint64 milestoneTotal = (vestingSchedule.end - vestingSchedule.start) /
            vestingSchedule.duration;

        // If all token is vested then return remaining amount
        if (block.timestamp > vestingSchedule.end) {
            return (
                milestoneTotal,
                vestingSchedule.total - vestingSchedule.totalClaimed
            );
        }

        // Milestone can't be greater than total milestones
        milestone = ((uint64(block.timestamp) - vestingSchedule.start) /
            vestingSchedule.duration);
        milestone = milestone >= milestoneTotal ? milestoneTotal : milestone;

        // Calculate claimable milestone
        milestone = milestone - vestingSchedule.milestonClaimed;

        // If it's first claim then we include the unlocked TGE amount
        if (vestingSchedule.totalClaimed == 0 && vestingSchedule.unlocked > 0) {
            return (
                milestone,
                (milestone * vestingSchedule.milestoneReleaseAmount) +
                    vestingSchedule.unlocked
            );
        }
        return (milestone, milestone * vestingSchedule.milestoneReleaseAmount);
    }
}
