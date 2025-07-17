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
error TGETimeMustBeInTheFuture(uint256 timestamp);

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
 */
struct VestingTerm {
    address beneficiary;
    uint64 cliff;
    uint64 vestingDuration;
    uint64 milestoneDuration;
    uint256 unlockedAtTGE;
    uint256 total;
}

/**
 * @dev Struct to store vesting schedule
 */
struct VestingSchedule {
    uint64 cliff;
    uint64 vestingDuration;
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
    address contractAddress;
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
    // Events
    event TokenClaimed(address beneficiary, uint64 milestone, uint256 amount);
    event UnlockAtTGE(address beneficiary, uint256 amount);
    event TransferVestingContract(
        address beneficiaryOld,
        address beneficiaryNew
    );

    // Functions

    // Initialization; callable only once
    function init(
        address onVestingMainAddress,
        VestingTerm memory vestingTerm
    ) external returns (bool);

    // Claim tokens (only beneficiary, after TGE)
    function claim() external;

    // Get start of vesting time
    function getTimeStart() external view returns (uint64);

    // Get End of vesting time
    function getTimeEnd() external view returns (uint64);

    // Transfer vesting contract to new beneficiary (only beneficiary)
    function transferVestingContract(address beneficiaryNew) external;

    // Return claimable balance for beneficiary
    function getClaimableBalance() external view returns (uint256);

    // Return remaining vesting balance
    function getRemainingBalance() external view returns (uint256);

    // Return full vesting detail struct
    function getVestingDetail() external view returns (VestingDetail memory);
}

/**
 * @title Orochi Network Vesting Main
 */
interface IONVestingMain {
    // Event
    event AddNewVestingContract(
        uint256 indexed vestingContractTotal,
        address indexed newVestingContract,
        address indexed beneficiary
    );
    event SetTimeTGE(uint256 timeTGE);
    event SetImplementation(address onVestingSubImpl);
    event SetTokenAddress(address onTokenAddress);
    event TransferToken(address to, uint256 value);

    // Functions
    function mint() external;

    function addVestingTerm(VestingTerm calldata vestingTerm) external;

    function getTokenAddress() external view returns (address);

    function getTimeTGE() external view returns (uint256);

    function getVestingDetailList(
        uint256 offset,
        uint256 limit
    ) external view returns (VestingDetail[] memory);

    function getVestingContractAddress(
        uint256 index
    ) external view returns (address);

    function getVestingContractTotal() external view returns (uint256);

    function isTGE() external view returns (bool);
}

/**
 * @title Orochi Network Token
 */
interface IONToken {
    // Standard ERC20 functions

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    // Custom public/external functions

    function mint() external returns (bool);

    // Ownership (from Ownable)

    function owner() external view returns (address);

    function transferOwnership(address newOwner) external;

    function renounceOwnership() external;
}
