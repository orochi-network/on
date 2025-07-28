// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ONCommon.sol";
import "../ONVestingMainBase.sol";

/**
 * @title Orochi Network Token
 */
contract MockVestingMain is
    ONVestingMainInterface,
    ONVestingMainBase,
    ReentrancyGuard
{
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
    ) ONVestingMainBase(tokenAddress, timestampTGE, onVestingSubImpl) {}

    /*******************************************************
     * External Owner
     ********************************************************/

    /**
     * Transfer token to the given address
     * @param to Address to transfer token to
     * @param value Amount of token to transfer
     * @dev Only callable by the owner
     */
    function transfer(address to, uint256 value) external nonReentrant {
        _transfer(to, value);
    }

    /*******************************************************
     * External Owner, before TGE
     ********************************************************/

    /**
     * Set ONToken address
     * @param tokenAddress Address of the ONToken contract
     * @dev Only callable by the owner before TGE
     */
    function setTokenAddress(address tokenAddress) external nonReentrant {
        _setTokenAddress(tokenAddress);
    }

    /**
     * Set ONVestingSub implementation
     * @param onVestingSubImpl Address of the ONVestingSub implementation
     * @dev Only callable by the owner before TGE
     */
    function setImplementation(address onVestingSubImpl) external nonReentrant {
        _setImplementation(onVestingSubImpl);
    }

    /**
     * Set TGE time
     * @param timestampTGE Timestamp of the TGE
     * @dev Only callable by the owner before TGE
     */
    function setTimeTGE(uint256 timestampTGE) external nonReentrant {
        _setTimeTGE(timestampTGE);
    }

    /**
     * Mint maxium supply to this contract
     */
    function mint() external nonReentrant {
        _mint();
    }

    /**
     * Add a vesting term to the contract
     * @param vestingTerm VestingTerm struct
     * @dev Only callable by the owner before TGE
     */
    function addVestingTerm(
        VestingTerm calldata vestingTerm
    ) external nonReentrant {
        _addVestingTerm(vestingTerm);
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Get ONVestingSub implementation address
     */
    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    /**
     * Get token address
     */
    function getTokenAddress() external view returns (address) {
        return _getTokenAddress();
    }

    /**
     * Get TGE time
     */
    function getTimeTGE() external view returns (uint256) {
        return _getTimeTGE();
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
        return _getVestingDetailList(offset, limit);
    }

    /**
     * Get vesting contract addresss at given index
     * @param index Index in contract map
     */
    function getVestingContractAddress(
        uint256 index
    ) external view returns (address) {
        return _getVestingContractAddress(index);
    }

    /**
     * Get total number of vesting contract
     */
    function getVestingContractTotal() external view returns (uint256) {
        return _getVestingContractTotal();
    }

    /**
     * Is TGE started or not
     */
    function isTGE() external view returns (bool) {
        return _isTGE();
    }
}
