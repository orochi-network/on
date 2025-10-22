// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ONCommon.sol";
import "../ONAirdropBase.sol";

/**
 * @title MockAirdrop
 */
contract MockAirdrop is ONAirdropBase, ReentrancyGuard {
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
    ) ONAirdropBase(onVestingMainAddress) {
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
        ProofPayloadInput calldata payloadInput
    ) external nonReentrant onlyPostTGE {
        ProofPayload memory payload = ProofPayload({
            beneficiary: msg.sender,
            chainid: uint64(block.chainid),
            contractAddress: address(this),
            nonce: payloadInput.nonce,
            timestamp: payloadInput.timestamp,
            amount: payloadInput.amount
        });
        _claim(ecdsaProof, payload);
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
    ) external nonReentrant {
        _addOperator(listOperator);
    }

    /**
     * Remove operators by a given list
     * @param listOperator List of operators
     */
    function removeOperator(
        address[] calldata listOperator
    ) external nonReentrant {
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
     * Get airdrop detail
     */
    function getAirdropDetail(
        address givenAddress
    ) external view returns (AidropDetail memory detail) {
        return _getAirdropDetail(givenAddress);
    }

    /**
     * Get encoded data and its message hash to make sure
     * off-chain message encoding is correct
     * @param beneficiary Token receiver
     * @param amount Amount of token
     */
    function getPayload(
        address beneficiary,
        uint256 amount
    )
        external
        view
        returns (ProofPayload memory payload, bytes memory encoded)
    {
        payload = _getPayload(beneficiary, amount);
        encoded = abi.encode(payload);
    }
}
