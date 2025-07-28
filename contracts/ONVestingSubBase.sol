// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "./interfaces/ONCommon.sol";
import "./interfaces/ONVestingSubBaseInterface.sol";

/**
 * @title Orochi Network Vesting Sub
 */
contract ONVestingSubBase is ONVestingSubBaseInterface {
    // Beneficiary of the vesting contract
    address private beneficiary;

    // Main vesting contract address
    ONVestingMainInterface private onVestingMain;

    // Schedule of vesting
    VestingSchedule private schedule;

    uint64 immutable MAX_MILESTONE_DURATION = (24 * 60 * 60 * 30) * 6; // 6 months

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
     * Internal
     ********************************************************/

    /**
     * Init method
     * @param onVestingMainAddress The address of the main vesting contract
     * @param vestingTerm Vesting term
     */
    function _init(
        address onVestingMainAddress,
        VestingTerm memory vestingTerm
    ) internal returns (bool) {
        if (
            onVestingMainAddress == address(0) ||
            vestingTerm.beneficiary == address(0)
        ) {
            revert InvalidAddress();
        }
        onVestingMain = ONVestingMainInterface(onVestingMainAddress);
        beneficiary = vestingTerm.beneficiary;
        emit TransferVestingContract(address(0), vestingTerm.beneficiary);
        _addVestingTerm(vestingTerm);
        return true;
    }

    /**
     * If token is vested but stuck in the smart contract
     * this method allow to withdraw all of them
     */
    function _emergency() internal {
        if (block.timestamp >= _timeEnd() + schedule.milestoneDuration) {
            VestingSchedule memory vestingSchedule = schedule;
            uint256 remaining = _getRemainingBalance();
            if (_getToken().transfer(beneficiary, remaining)) {
                vestingSchedule.totalClaimed = remaining;
                vestingSchedule.milestoneClaimed =
                    vestingSchedule.vestingDuration /
                    vestingSchedule.milestoneDuration;
                schedule = vestingSchedule;
                emit EmergencyWithdraw(beneficiary, remaining);
                return;
            }
        }
        revert UnableToCallEmergency();
    }

    /**
     * Transfer vesting contract to new owner
     * @param beneficiaryNew New vesting contract owner
     */
    function _transferVestingContract(address beneficiaryNew) internal {
        if (beneficiaryNew == address(0) || beneficiaryNew == beneficiary) {
            revert InvalidBeneficiary(beneficiaryNew);
        }
        emit TransferVestingContract(beneficiary, beneficiaryNew);
        beneficiary = beneficiaryNew;
    }

    /**
     * Claim tokens for a benefi account
     */
    function _claim(address account) internal {
        VestingSchedule memory vestingSchedule = schedule;

        // If there is no token then vesting schedule is invalid
        if (_getRemainingBalance() <= 0) {
            revert InvalidVestingSchedule(account);
        }

        (uint64 milestone, uint256 amount) = _balance();

        // Check if there is any claimable token left
        if (amount == 0) {
            revert NoClaimableToken(account, milestone);
        }

        if (amount > _getRemainingBalance()) {
            revert InsufficientBalance(account, amount, _getRemainingBalance());
        }

        // Update the vesting schedule
        vestingSchedule.milestoneClaimed = milestone;
        vestingSchedule.totalClaimed += amount;
        schedule = vestingSchedule;

        if (!_getToken().transfer(account, amount)) {
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
                cliff: 0,
                vestingDuration: 0,
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
            term.milestoneDuration > 0 &&
            term.milestoneDuration <= MAX_MILESTONE_DURATION &&
            term.cliff >= 0 &&
            term.cliff <= term.vestingDuration &&
            term.vestingDuration >= term.milestoneDuration
        ) {
            uint256 remaining = term.total - term.unlockedAtTGE;
            uint256 milestoneTotal = term.vestingDuration /
                term.milestoneDuration;
            uint256 milestoneReleaseAmount = remaining / milestoneTotal;

            // Calculate the amount to unlock at TGE
            if (term.unlockedAtTGE > 0) {
                emit UnlockAtTGE(term.beneficiary, term.unlockedAtTGE);
            }

            schedule = VestingSchedule({
                cliff: term.cliff,
                vestingDuration: term.vestingDuration,
                milestoneDuration: term.milestoneDuration,
                milestoneClaimed: 0,
                milestoneReleaseAmount: milestoneReleaseAmount,
                unlockedAtTGE: term.unlockedAtTGE,
                totalClaimed: 0
            });
            return;
        }
        revert InvalidVestingTerm(term.beneficiary);
    }

    /*******************************************************
     * Internal View
     ********************************************************/

    /**
     * Get beneficiary address
     */
    function _getBeneficiary() internal view returns (address) {
        return beneficiary;
    }

    /**
     * Claimable token balance of the given account
     */
    function _getClaimableBalance() internal view returns (uint256) {
        (, uint256 amount) = _balance();
        return amount;
    }

    /**
     * Get vesting schedule of the given account
     */
    function _getVestingDetail() internal view returns (VestingDetail memory) {
        VestingSchedule memory vestingSchedule = schedule;
        VestingDetail memory vestingDetail = VestingDetail({
            contractAddress: address(this),
            beneficiary: beneficiary,
            start: _timeStart(),
            end: _timeEnd(),
            milestoneDuration: vestingSchedule.milestoneDuration,
            milestoneClaimed: vestingSchedule.milestoneClaimed,
            milestoneReleaseAmount: vestingSchedule.milestoneReleaseAmount,
            unlockedAtTGE: vestingSchedule.unlockedAtTGE,
            totalClaimed: vestingSchedule.totalClaimed,
            balanceClaimable: _getClaimableBalance(),
            balanceRemain: _getRemainingBalance()
        });

        return vestingDetail;
    }

    /*******************************************************
     * Internal View
     ********************************************************/

    /**
     * Get ON token instance
     */
    function _getToken() internal view returns (ONTokenInterface) {
        return ONTokenInterface(onVestingMain.getTokenAddress());
    }

    /**
     * Start of vesting time
     */
    function _timeStart() internal view returns (uint64) {
        return uint64(onVestingMain.getTimeTGE() + schedule.cliff);
    }

    /**
     * End of vesting time
     */
    function _timeEnd() internal view returns (uint64) {
        return _timeStart() + schedule.vestingDuration;
    }

    /**
     * Vesting balance
     */
    function _getRemainingBalance() internal view returns (uint256) {
        return _getToken().balanceOf(address(this));
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

        // Check for the normal vesting schedule where
        // the contract is a not vested immediately
        if (
            vestingSchedule.vestingDuration > 0 &&
            vestingSchedule.milestoneDuration > 0 &&
            vestingSchedule.vestingDuration >= vestingSchedule.milestoneDuration
        ) {
            // Calculate total milestones
            uint64 milestoneTotal = vestingSchedule.vestingDuration /
                vestingSchedule.milestoneDuration;
            uint64 currentTime = uint64(block.timestamp);
            milestone = currentTime > _timeStart()
                ? ((currentTime - _timeStart()) /
                    vestingSchedule.milestoneDuration)
                : 0;
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
        } else if (
            vestingSchedule.unlockedAtTGE > 0 &&
            vestingSchedule.totalClaimed == 0
        ) {
            return (0, vestingSchedule.unlockedAtTGE);
        }
        return (0, 0);
    }
}
