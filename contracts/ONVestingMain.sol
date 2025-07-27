// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ONCommon.sol";
import "./ONVestingMainBase.sol";

/**
 * @title Orochi Network Token
 */
contract ONVestingMain is
    ONVestingMainInterface,
    ONVestingMainBase,
    ReentrancyGuard,
    Ownable
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
    )
        Ownable(msg.sender)
        ONVestingMainBase(tokenAddress, timestampTGE, onVestingSubImpl)
    {}

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
        _transfer(to, value);
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
        _mint();
    }

    /**
     * Add a vesting term to the contract
     * @dev Only callable by the owner before TGE
     * @param vestingTerm VestingTerm struct
     */
    function addVestingTerm(
        VestingTerm calldata vestingTerm
    ) external onlyOwner nonReentrant onlyPreTGE {
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
