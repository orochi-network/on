// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ONInterface.sol";

/**
 * @title Orochi Network Vesting Sub
 */
contract ONVestingSub is IONVestingSub, ReentrancyGuard {
    // Beneficiary of the vesting contract
    address private beneficiary;

    // Main vesting contract address
    IONVestingMain private onVestingMain;

    // Token contract address
    IONToken token;

    // Schedule of vesting
    VestingSchedule private schedule;

    // Event emitted when token is claimed
    event TokenClaimed(address beneficiary, uint64 milestone, uint256 amount);

    // Event emitted when token is unlockedAtTGE at TGE
    event UnlockAtTGE(address beneficiary, uint256 amount);

    // Event transfer a vesting contract
    event TransferVestingContract(
        address beneficiaryOld,
        address beneficiaryNew
    );

    /**
     * @dev Modifier to make sure that the TGE is started
     */
    modifier onlyPostTGE() {
        if (!onVestingMain.isTGE()) {
            revert TGENotStarted();
        }
        _;
    }

    /**
     * @dev Modifier to make sure that this contract wasn't initialized
     */
    modifier onlyOnce() {
        if (beneficiary != address(0)) {
            revert UnableToInitTwice();
        }
        _;
    }

    /**
     * @dev Modifier to make sure that the caller is the beneficiary of the vesting contract
     */
    modifier onlyBeneficiary() {
        if (msg.sender != beneficiary) {
            revert InvalidBeneficiary(msg.sender);
        }
        _;
    }

    /*******************************************************
     * Init method
     ********************************************************/

    /**
     * Init method
     * @param onVestingMainAddress The address of the main vesting contract
     * @param vestingTerm Vesting term
     * @param tokenAddress The address of the token contract
     */
    function init(
        address onVestingMainAddress,
        VestingTerm memory vestingTerm,
        address tokenAddress
    ) external onlyOnce nonReentrant returns (bool) {
        if (
            tokenAddress == address(0) ||
            onVestingMainAddress == address(0) ||
            vestingTerm.beneficiary == address(0)
        ) {
            revert InvalidAddress();
        }
        token = IONToken(tokenAddress);
        onVestingMain = IONVestingMain(onVestingMainAddress);
        beneficiary = vestingTerm.beneficiary;
        _addVestingTerm(vestingTerm);
        return true;
    }

    /*******************************************************
     * External Only Beneficiary
     ********************************************************/

    /**
     * Claim tokens for the sender
     * @dev Only callable after TGE
     */
    function claim() external nonReentrant onlyPostTGE onlyBeneficiary {
        _claim(beneficiary);
    }

    /**
     * Transfer vesting contract to new owner
     * @param beneficiaryNew New vesting contract owner
     */
    function transferVestingContract(
        address beneficiaryNew
    ) external nonReentrant onlyBeneficiary {
        emit TransferVestingContract(beneficiary, beneficiaryNew);
        beneficiary = beneficiaryNew;
    }

    /*******************************************************
     * Internal
     ********************************************************/

    /**
     * Claim tokens for a single account
     * @param account Address of the account to claim tokens for
     */
    function _claim(address account) internal {
        VestingSchedule memory vestingSchedule = schedule;

        // If there is no token then vesting schedule is invalid
        if (_getRemainingBalance() <= 0) {
            revert InvalidVestingSchedule(account);
        }

        (uint64 milestone, uint256 amount) = _balance();

        // Check if there is any claimable token left
        if (milestone > 0 && milestone == vestingSchedule.milestoneClaimed) {
            revert NoClaimableToken(account, milestone);
        }

        if (amount > _getRemainingBalance()) {
            revert InsufficientBalance(account, amount, _getRemainingBalance());
        }

        // Update the vesting schedule
        vestingSchedule.milestoneClaimed = milestone;
        vestingSchedule.totalClaimed += amount;
        schedule = vestingSchedule;

        if (!token.transfer(account, amount)) {
            revert UnableToRelease(account, milestone, amount);
        }

        emit TokenClaimed(account, milestone, amount);
    }

    /**
     * Add a vesting term to the contract
     * @dev Only callable by the owner before TGE
     * @param term VestingTerm struct
     */
    function _addVestingTerm(VestingTerm memory term) internal {
        if (term.total == term.unlockedAtTGE) {
            schedule = VestingSchedule({
                start: uint64(block.timestamp),
                end: uint64(block.timestamp),
                milestoneDuration: 0,
                milestoneClaimed: 0,
                milestoneReleaseAmount: 0,
                unlockedAtTGE: term.unlockedAtTGE,
                totalClaimed: 0
            });
            // If the total amount is equal to the unlockedAtTGE then we can skip the vesting schedule
            emit UnlockAtTGE(term.beneficiary, term.unlockedAtTGE);
            return;
        }

        // Filter invalid terms
        if (
            term.total > term.unlockedAtTGE &&
            term.start > block.timestamp &&
            term.milestoneDuration > 0 &&
            term.end >= (term.start + term.milestoneDuration)
        ) {
            uint256 remaining = term.total - term.unlockedAtTGE;
            uint256 milestoneTotal = (term.end - term.start) /
                term.milestoneDuration;
            uint256 milestoneReleaseAmount = remaining / milestoneTotal;
            if (milestoneTotal > 0 && milestoneReleaseAmount > 0) {
                // Calculate the amount to unlock at TGE
                if (term.unlockedAtTGE > 0) {
                    emit UnlockAtTGE(term.beneficiary, term.unlockedAtTGE);
                }

                schedule = VestingSchedule({
                    start: term.start,
                    end: term.end,
                    milestoneDuration: term.milestoneDuration,
                    milestoneClaimed: 0,
                    milestoneReleaseAmount: milestoneReleaseAmount,
                    unlockedAtTGE: term.unlockedAtTGE,
                    totalClaimed: 0
                });
                return;
            }
        }
        revert InvalidVestingTerm();
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Claimable token balance of the given account
     */
    function getClaimableBalance() external view returns (uint256) {
        (, uint256 amount) = _balance();
        return amount;
    }

    /**
     * Vesting balance
     */
    function getRemainingBalance() external view returns (uint256) {
        return _getRemainingBalance();
    }

    /**
     * Get vesting schedule of the given account
     */
    function getVestingDetail() external view returns (VestingDetail memory) {
        VestingSchedule memory vestingSchedule = schedule;
        (, uint256 balance) = _balance();
        VestingDetail memory vestingDetail = VestingDetail({
            contractAddress: address(this),
            beneficiary: beneficiary,
            start: vestingSchedule.start,
            end: vestingSchedule.end,
            milestoneDuration: vestingSchedule.milestoneDuration,
            milestoneClaimed: vestingSchedule.milestoneClaimed,
            milestoneReleaseAmount: vestingSchedule.milestoneReleaseAmount,
            unlockedAtTGE: vestingSchedule.unlockedAtTGE,
            totalClaimed: vestingSchedule.totalClaimed,
            balanceClaimable: balance,
            balanceRemain: _getRemainingBalance()
        });

        return vestingDetail;
    }

    /*******************************************************
     * Internal View
     ********************************************************/

    /**
     * Vesting balance
     */
    function _getRemainingBalance() internal view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * Calculate balance of the given account and milestone
     * @return milestone Claimable milestone
     * @return amount Claimable amount
     */
    function _balance()
        internal
        view
        returns (uint64 milestone, uint256 amount)
    {
        VestingSchedule memory vestingSchedule = schedule;
        // This schedule vested at TGE
        if (
            vestingSchedule.unlockedAtTGE > 0 &&
            vestingSchedule.totalClaimed == 0
        ) {
            return (0, vestingSchedule.unlockedAtTGE);
        }

        // Only start vesting
        if (
            block.timestamp >= vestingSchedule.start &&
            vestingSchedule.milestoneDuration > 0
        ) {
            // Calculate total milestones
            uint64 milestoneTotal = (vestingSchedule.end -
                vestingSchedule.start) / vestingSchedule.milestoneDuration;

            milestone = ((uint64(block.timestamp) - vestingSchedule.start) /
                vestingSchedule.milestoneDuration);
            // Milestone can't be greater than total milestones
            milestone = milestone >= milestoneTotal
                ? milestoneTotal
                : milestone;

            uint256 claimableAmount = milestone *
                vestingSchedule.milestoneReleaseAmount +
                vestingSchedule.unlockedAtTGE;
            if (claimableAmount > vestingSchedule.totalClaimed) {
                return (
                    milestone,
                    claimableAmount - vestingSchedule.totalClaimed
                );
            }
        }
        return (0, 0);
    }
}
