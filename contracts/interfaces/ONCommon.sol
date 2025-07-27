// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

error TGENotStarted();
error TGEAlreadyStarted();
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
 * @title Orochi Network Token Interface
 */
interface ONTokenInterface {
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

/**
 * @title Orochi Network Vesting Sub Interface
 */
interface ONVestingSubInterface {
    // Init
    function init(
        address onVestingMainAddress,
        VestingTerm memory vestingTerm
    ) external returns (bool);

    // Beneficiary actions
    function claim() external;

    function emergency() external;

    function transferVestingContract(address beneficiaryNew) external;

    // Views
    function getBeneficiary() external view returns (address);

    function getTimeStart() external view returns (uint64);

    function getTimeEnd() external view returns (uint64);

    function getClaimableBalance() external view returns (uint256);

    function getRemainingBalance() external view returns (uint256);

    function getVestingDetail() external view returns (VestingDetail memory);
}

/**
 * @title Orochi Network Vesting Main Interface
 */
interface ONVestingMainInterface {
    // External functions
    function transfer(address to, uint256 value) external;

    function setTokenAddress(address tokenAddress) external;

    function setImplementation(address onVestingSubImpl) external;

    function setTimeTGE(uint256 timestampTGE) external;

    function mint() external;

    function addVestingTerm(VestingTerm calldata vestingTerm) external;

    // View functions
    function getImplementation() external view returns (address);

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
