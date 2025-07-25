// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {TGEAlreadyStarted, IONVestingMain, IONToken, InvalidOffsetOrLimit, VestingTerm, VestingDetail, UnableToTransfer, IONVestingSub, UnableToAddNewVestingContract, InvalidAddress, TGETimeMustBeInTheFuture, IONVestingSub} from "./ONInterface.sol";

/**
 * @title Orochi Network Token
 */
contract ONVestingMain is IONVestingMain, ReentrancyGuard, Ownable {
    // Allow main to clone sub contract
    using Clones for address;

    // Token contract address
    IONToken private token;

    // TGE time
    uint256 private timeTGE;

    // Based implementation of ON Vesting Sub
    address private onVestingSub;

    // Total number of vesting contract
    uint256 private vestingContractTotal;

    // Mapping from index to vesting contract address
    mapping(uint256 => address) private vestingContractMap;

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
        address onVestingSubImpl
    ) Ownable(msg.sender) {
        _setTokenAddress(tokenAddress);
        _setImplementation(onVestingSubImpl);
        _setTimeTGE(timestampTGE);
    }

    /*******************************************************
     * External Owner
     ********************************************************/

    /**
     * Set ONToken address
     */
    function transfer(
        address to,
        uint256 value
    ) external onlyOwner nonReentrant {
        if (token.transfer(to, value)) {
            emit TransferToken(to, value);
            return;
        }
        revert UnableToTransfer(to, value);
    }

    /**
     * Set ONToken address
     */
    function setTokenAddress(
        address tokenAddress
    ) external onlyOwner nonReentrant onlyPreTGE {
        _setTokenAddress(tokenAddress);
    }

    /**
     * Set ONVestingSub implementation
     */
    function setImplementation(
        address onVestingSubImpl
    ) external onlyOwner nonReentrant onlyPreTGE {
        _setImplementation(onVestingSubImpl);
    }

    /**
     * Set TGE time
     */
    function setTimeTGE(
        uint256 timestampTGE
    ) external onlyOwner nonReentrant onlyPreTGE {
        _setTimeTGE(timestampTGE);
    }

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
                vestingTerm
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
     * Internal
     ********************************************************/

    /**
     * Set ONVestingSub implementation address
     * @param onVestingSubImpl Address of ONVestingSub implementation
     */
    function _setImplementation(address onVestingSubImpl) internal {
        if (onVestingSubImpl == address(0)) {
            revert InvalidAddress();
        }
        onVestingSub = onVestingSubImpl;
        emit SetImplementation(onVestingSubImpl);
    }

    /**
     * Set ONToken address
     * @param onTokenAddress On token addresss
     */
    function _setTokenAddress(address onTokenAddress) internal {
        if (onTokenAddress == address(0)) {
            revert InvalidAddress();
        }
        token = IONToken(onTokenAddress);
        emit SetTokenAddress(onTokenAddress);
    }

    /**
     * Set the TGE time
     * @param timestampTGE Timestamp of the TGE
     */
    function _setTimeTGE(uint256 timestampTGE) internal {
        if (timestampTGE <= block.timestamp) {
            revert TGETimeMustBeInTheFuture(timestampTGE);
        }
        timeTGE = timestampTGE;
        emit SetTimeTGE(timestampTGE);
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Get ONVestingSub implementation address
     */
    function getImplementation() external view returns (address) {
        return address(onVestingSub);
    }

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
        uint256 end = offset + limit;
        if (end > vestingContractTotal) {
            end = vestingContractTotal;
        }
        uint256 recordCount = end - offset;
        if (recordCount <= 0) {
            revert InvalidOffsetOrLimit(offset, limit);
        }
        VestingDetail[] memory vestingDetailList = new VestingDetail[](
            recordCount
        );
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
