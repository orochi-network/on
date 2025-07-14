// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//IOVestingMain
error UnableToAddNewVestingContract(address beneficiary);

error UnableToRelease(address account, uint64 milestone, uint256 amount);
error VestingWasNotStarted(address account, uint64 timestamp, uint64 start);
error NoClaimableToken(address account, uint64 milestone);
error InsufficientBalance(address account, uint256 amount, uint256 remaining);
error InvalidVestingTerm();
error InvalidVestingSchedule(address account);
error UnableToAirdropToken(address beneficiary, uint256 amount);
error InvalidBeneficiary(address beneficiary);
error BeneficiaryAmountMismatch(uint256 beneficaryList, uint256 amountList);

error BeneficiaryAlreadyAdded(address account);
error UnableToTransferVestingContract(
    address beneficiaryOld,
    address beneficiaryNew
);
error TGENotStarted();
error TGEAlreadyStarted();
error UnableToInitTwice();
error InvalidAddress();

/**
 * @dev Struct to define vesting term
 *
 */
struct VestingTerm {
    address beneficiary;
    uint64 start;
    uint64 end;
    uint64 milestoneDuration;
    uint256 unlockedAtTGE;
    uint256 total;
}

/**
 * @dev Struct to store vesting schedule
 */
struct VestingSchedule {
    uint64 start;
    uint64 end;
    uint64 milestoneDuration;
    uint64 milestoneClaimed;
    uint256 milestoneReleaseAmount;
    uint256 unlockedAtTGE;
    uint256 totalClaimed;
}

/**
 * @dev Struct to store vesting schedule
 */
struct VestingDetail {
    address beneficiary;
    uint64 start;
    uint64 end;
    uint64 milestoneDuration;
    uint64 milestoneClaimed;
    uint256 milestoneReleaseAmount;
    uint256 unlockedAtTGE;
    uint256 totalClaimed;
    uint256 balanceClaimable;
    uint256 balanceRemain;
}

/**
 * @title Orochi Network Vesting Sub
 */
interface IONVestingSub {
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
    ) external returns (bool);

    /**
     * Claimable token balance of the given account
     */
    function getBalance() external view returns (uint256);

    /**
     * Vesting balance
     */
    function getVestingBalance() external view returns (uint256);

    /**
     * Get vesting schedule of the given account
     */
    function getVestingDetail() external view returns (VestingDetail memory);
}

/**
 * @title Orochi Network Vesting Main
 */
interface IONVestingMain {
    /**
     * Get TGE time
     * @return TGE time in seconds since epoch
     */
    function getTimeTGE() external view returns (uint256);

    /**
     * Check if TGE has started
     * @return true if TGE has started, false otherwise
     */
    function isTGE() external view returns (bool);

    /**
     * Get token address
     */
    function getTokenAddress() external view returns (address);
}

interface IONToken is IERC20 {
    function mint() external returns (bool);
}
