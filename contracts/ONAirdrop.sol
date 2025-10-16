// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ONCommon.sol";
import "./ONAirdropBase.sol";

/**
 * @title Orochi Network Airdrop
 */
contract ONAirdrop is ONAirdropBase, ReentrancyGuard, Ownable {
    /*******************************************************
     * Constructor
     ********************************************************/

    /**
     * Constructor
     * @param onVestingMainAddress The address of the vesting contract
     */
    constructor(
        address onVestingMainAddress,
        address[] memory listOperator
    ) Ownable(msg.sender) ONAirdropBase(onVestingMainAddress) {
        _addOperator(listOperator);
    }

    /*******************************************************
     * External, after TGE
     ********************************************************/

    /**
     * Claim tokens for the user from airdrop
     * @dev Only callable after TGE
     */
    function claim(
        bytes calldata ecdsaProof,
        uint256 amount
    ) external nonReentrant onlyPostTGE {
        _claim(ecdsaProof, msg.sender, amount);
    }

    /*******************************************************
     * External view
     ********************************************************/
    /**
     * Add operators by a given list
     * @param listOperator List of operators
     */
    function addOperator(
        address[] calldata listOperator
    ) external onlyOwner nonReentrant {
        _addOperator(listOperator);
    }

    /**
     * Remove operators by a given list
     * @param listOperator List of operators
     */
    function removeOperator(
        address[] calldata listOperator
    ) external onlyOwner nonReentrant {
        _removeOperator(listOperator);
    }

    /*******************************************************
     * External view
     ********************************************************/

    /**
     * Get ON token instance
     */
    function getToken() external view returns (ONTokenInterface) {
        return _getToken();
    }

    /**
     * Check an address is a operator
     */
    function isOperator(address givenAddress) external view returns (bool) {
        return _isOperator(givenAddress);
    }

    /**
     * Get total redeemed of a given address
     */
    function getRedeemed(address givenAddress) external view returns (uint256) {
        return _getRedeemed(givenAddress);
    }

    /**
     * Get nonce of a given address
     */
    function getNonce(address givenAddress) external view returns (uint256) {
        return _getNonce(givenAddress);
    }

    /**
     * Get encoded data and its message hash to make sure
     * off-chain message encode is correct
     * @param beneficiary Token receiver
     * @param amount Amount of token
     */
    function getEncodeData(
        address beneficiary,
        uint256 amount
    )
        external
        view
        returns (bytes memory encodedData, bytes32 encodedMessageHash)
    {
        return _getEncodeData(beneficiary, amount);
    }
}
