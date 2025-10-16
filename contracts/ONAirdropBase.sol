// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/ONCommon.sol";

/**
 * @title Orochi Network Airdrop Base
 */
contract ONAirdropBase {
    using ECDSA for bytes32;

    using MessageHashUtils for bytes;

    // Errors
    error AirdropTransferFailed(address beneficiary, uint256 amount);
    error InvalidProofSigner(address signer);

    // Main vesting contract address
    ONVestingMainInterface immutable onVestingMain;

    // Airdrop map for airdrop recipients
    mapping(address => uint256) private nonceMap;

    // Operator check
    mapping(address => bool) private operatorMap;

    // Redeemed map
    mapping(address => uint256) private redeemMap;

    // Events
    event AirdropClaimed(address indexed account, uint256 indexed amount);
    event AddOperator(address indexed operator);
    event RemoveOperator(address indexed operator);

    /**
     * @dev Modifier to make sure that the TGE is started
     */
    modifier onlyPostTGE() {
        // Post TGE require isTGE to be true, so if it's false should be reverted
        if (!onVestingMain.isTGE()) {
            revert TGENotStarted();
        }
        _;
    }

    /*******************************************************
     * Constructor
     ********************************************************/

    /**
     * Constructor
     * @param onVestingMainAddress The address of the vesting contract
     */
    constructor(address onVestingMainAddress) {
        onVestingMain = ONVestingMainInterface(onVestingMainAddress);
    }

    /*******************************************************
     * Internal Owner
     ********************************************************/

    /**
     * Add operators by a given list
     * @param listOperator List of operators
     */
    function _addOperator(address[] memory listOperator) internal {
        for (uint256 i = 0; i < listOperator.length; i += 1) {
            operatorMap[listOperator[i]] = true;
            emit AddOperator(listOperator[i]);
        }
    }

    /**
     * Remove operators by a given list
     * @param listOperator List of operators
     */
    function _removeOperator(address[] memory listOperator) internal {
        for (uint256 i = 0; i < listOperator.length; i += 1) {
            operatorMap[listOperator[i]] = false;
            emit RemoveOperator(listOperator[i]);
        }
    }

    /*******************************************************
     * Internal
     ********************************************************/

    /**
     * Claim tokens for the user from airdrop
     * @dev Only callable after TGE
     */
    function _claim(
        bytes calldata ecdsaProof,
        address beneficiary,
        uint256 amount
    ) internal {
        // Recover signer from ECDSA proof (Wrong nonce will make the signature invalid)
        address signer = _getEncodeData(beneficiary, amount)
            .toEthSignedMessageHash()
            .recover(ecdsaProof);

        // Signer must be the operator
        if (!operatorMap[signer]) {
            revert InvalidProofSigner(signer);
        }

        // Process transfer
        if (amount > 0 && _getToken().transfer(beneficiary, amount)) {
            nonceMap[beneficiary] += 1;
            redeemMap[beneficiary] += amount;
            emit AirdropClaimed(beneficiary, amount);
            return;
        }

        // Unable to claim token due to transaction fail
        revert AirdropTransferFailed(beneficiary, amount);
    }

    /*******************************************************
     * Internal view
     ********************************************************/

    /**
     * Get ON token instance
     */
    function _getToken() internal view returns (ONTokenInterface) {
        return ONTokenInterface(onVestingMain.getTokenAddress());
    }

    /**
     * Check an address is an operator
     */
    function _isOperator(address givenAddress) internal view returns (bool) {
        return operatorMap[givenAddress];
    }

    /**
     * Get nonce of a given address
     */
    function _getNonce(address givenAddress) internal view returns (uint256) {
        return nonceMap[givenAddress];
    }

    /**
     * Get total redeemed of a given address
     */
    function _getRedeemed(
        address givenAddress
    ) internal view returns (uint256) {
        return redeemMap[givenAddress];
    }

    /**
     * Get encoded data and its message hash to make sure
     * off-chain message encoding is correct
     * @param beneficiary Token receiver
     * @param amount Amount of token
     */
    function _getEncodeData(
        address beneficiary,
        uint256 amount
    ) internal view returns (bytes memory encodedData) {
        encodedData = abi.encodePacked(
            beneficiary,
            amount,
            nonceMap[beneficiary],
            address(this),
            block.chainid
        );
        return encodedData;
    }
}
