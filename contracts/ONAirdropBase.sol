// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ONCommon.sol";

/**
 * @title Orochi Network Airdrop
 */
contract ONAirdropBase {
    // Errors
    error AirdropTransferFailed(address beneficiary, uint256 amount);
    error RecipientAmountLengthMismatch(
        uint256 beneficiaryCount,
        uint256 amountCount
    );

    // Main vesting contract address
    ONVestingMainInterface private onVestingMain;

    // Airdrop map for airdrop recipients
    mapping(address => uint256) private airdrop;

    // Event emitted when airdrop is claimed
    event AirdropClaimed(address account, uint256 amount);

    // Event emitted when airdrop is add
    event AirdropRecipientAdded(address account, uint256 amount);

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

    /**
     * @dev Modifier to make sure that the TGE is started
     */
    modifier onlyPreTGE() {
        // Pre TGE require isTGE to be false, so if it's true should be reverted
        if (onVestingMain.isTGE()) {
            revert TGEAlreadyStarted();
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
     * Internal
     ********************************************************/

    /**
     * Claim tokens for the user from airdrop
     * @dev Only callable after TGE
     */
    function _claim() internal {
        address beneficiary = msg.sender;
        uint256 amount = airdrop[beneficiary];
        if (amount > 0 && _getToken().transfer(beneficiary, amount)) {
            emit AirdropClaimed(beneficiary, amount);
            airdrop[beneficiary] = 0;
            return;
        }
        revert AirdropTransferFailed(beneficiary, amount);
    }

    /**
     * Add users to the airdrop pool
     * @dev Only callable by the owner before TGE. Emits TGEStarted event.
     * @param beneficaryList Array of beneficiaries
     * @param amountList Array of amountList
     */
    function _addRecipient(
        address[] memory beneficaryList,
        uint256[] memory amountList
    ) internal {
        if (beneficaryList.length != amountList.length) {
            revert RecipientAmountLengthMismatch(
                beneficaryList.length,
                amountList.length
            );
        }
        for (uint256 i = 0; i < beneficaryList.length; i += 1) {
            if (beneficaryList[i] != address(0) && amountList[i] > 0) {
                airdrop[beneficaryList[i]] += amountList[i];
                emit AirdropRecipientAdded(beneficaryList[i], amountList[i]);
            }
        }
    }

    /*******************************************************
     * Internal view
     ********************************************************/

    /**
     * Balance of airdrop for the given account
     * @param account Address of the account
     */
    function _getAirdropBalance(
        address account
    ) internal view returns (uint256) {
        return airdrop[account];
    }

    /**
     * Get ON token instance
     */
    function _getToken() internal view returns (ONTokenInterface) {
        return ONTokenInterface(onVestingMain.getTokenAddress());
    }
}
