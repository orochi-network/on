// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ONInterface.sol";

/**
 * @title Orochi Network Token
 */
contract ONVestingMain is IONVestingMain, ReentrancyGuard, Ownable {
    // Allow main to clone sub contract
    using Clones for address;

    // Token contract address
    IONToken token;

    // TGE time
    uint256 private timeTGE;

    address private onVestingSub;

    // Total number of vesting contract
    uint256 private vestingContractTotal;

    // Mapping from index to vesting contract address
    mapping(uint256 => address) vestingContractMap;

    // Event emitted when new vesting contract was created
    event AddNewVestingContract(
        uint256 indexed vestingContractTotal,
        address indexed newVestingContract,
        address indexed beneficiary
    );

    /**
     * @dev Modifier to make sure that the TGE is started
     */
    modifier onlyPostTGE() {
        // It's require isTGE to be true to move one
        if (!_isTGE()) {
            revert TGENotStarted();
        }
        _;
    }

    /**
     * @dev Modifier to make sure that the TGE is not started yet
     */
    modifier onlyPreTGE() {
        // It's require isTGE to be false to move one
        if (_isTGE()) {
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
    constructor(
        address tokenAddress,
        uint256 timestampTGE,
        address onVestingSubImplementation
    ) Ownable() {
        token = IONToken(tokenAddress);
        timeTGE = timestampTGE;
        onVestingSub = onVestingSubImplementation;
    }

    /*******************************************************
     * Owner Pre TGE
     ********************************************************/

    /**
     * Mint maxium supply to this contract
     */
    function mint() external onlyOwner nonReentrant onlyPreTGE {
        token.mint();
    }

    /**
     * Add a vesting term to the contract
     * @dev Only callable by the owner before TGE
     * @param vestingTerm VestingTerm struct
     */
    function addVestingTerm(
        VestingTerm calldata vestingTerm
    ) external onlyOwner nonReentrant onlyPreTGE {
        // Clone ONVestingSub
        address newVestingContract = onVestingSub.cloneDeterministic(
            bytes32(vestingContractTotal)
        );
        vestingContractMap[vestingContractTotal] = newVestingContract;
        // Init ONVestingSub with its vesting term
        if (
            IONVestingSub(newVestingContract).init(
                address(this),
                vestingTerm,
                address(token)
            ) && token.transfer(newVestingContract, vestingTerm.total)
        ) {
            emit AddNewVestingContract(
                vestingContractTotal,
                newVestingContract,
                vestingTerm.beneficiary
            );
            vestingContractTotal += 1;
            return;
        }
        revert UnableToAddNewVestingContract(vestingTerm.beneficiary);
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Get token address
     */
    function getTokenAddress() external view returns (address) {
        return address(token);
    }

    /**
     * Get TGE time
     */
    function getTimeTGE() external view returns (uint256) {
        return timeTGE;
    }

    /**
     * Get all vesting detail
     * @param offset Offset in the list
     * @param limit Number of record
     */
    function getVestingDetailList(
        uint256 offset,
        uint256 limit
    ) external view returns (VestingDetail[] memory) {
        VestingDetail[] memory vestingDetailList = new VestingDetail[](limit);
        uint256 end = offset + limit;

        for (uint i = offset; i < end; i += 1) {
            vestingDetailList[i] = IONVestingSub(vestingContractMap[i])
                .getVestingDetail();
        }
        return vestingDetailList;
    }

    /**
     * Get vesting contract addresss at given index
     * @param index Index in contract map
     */
    function getVestingContractAddress(
        uint256 index
    ) external view returns (address) {
        return vestingContractMap[index];
    }

    /**
     * Get total number of vesting contract
     */
    function getVestingContractTotal() external view returns (uint256) {
        return vestingContractTotal;
    }

    /**
     * Is TGE started or not
     */
    function isTGE() external view returns (bool) {
        return _isTGE();
    }

    /*******************************************************
     * Internal View
     ********************************************************/

    /**
     * Check if TGE is happend or not
     */
    function _isTGE() internal view returns (bool) {
        return block.timestamp >= timeTGE;
    }
}
