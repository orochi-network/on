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
        address onVestingMainAddress
    ) Ownable(msg.sender) ONAirdropBase(onVestingMainAddress) {}

    /*******************************************************
     * External Post TGE
     ********************************************************/

    /**
     * Claim tokens for the user from airdrop
     * @dev Only callable after TGE
     */
    function claim() external nonReentrant onlyPostTGE {
        _claim();
    }

    /*******************************************************
     * Owner Pre TGE
     ********************************************************/

    /**
     * Add users to the airdrop pool
     * @dev Only callable by the owner before TGE. Emits TGEStarted event.
     * @param beneficaryList Array of beneficiaries
     * @param amountList Array of amountList
     */
    function addRecipient(
        address[] memory beneficaryList,
        uint256[] memory amountList
    ) external nonReentrant onlyOwner onlyPreTGE {
        _addRecipient(beneficaryList, amountList);
    }

    /*******************************************************
     * External view
     ********************************************************/

    /**
     * Balance of airdrop for the given account
     * @param account Address of the account
     */
    function getAirdropBalance(
        address account
    ) external view returns (uint256) {
        return _getAirdropBalance(account);
    }
}
