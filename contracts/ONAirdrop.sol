// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ONInterface.sol";

/**
 * @title Orochi Network Airdrop
 */
contract ONAirdrop is ReentrancyGuard, Ownable {
    // Main vesting contract address
    IONVestingMain private onVestingMain;

    // Airdrop map for airdrop recipients
    mapping(address => uint256) private airdrop;

    // Event emitted when airdrop is claimed
    event AirdropClaim(address account, uint256 amount);

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
        onVestingMain = IONVestingMain(onVestingMainAddress);
    }

    /*******************************************************
     * External Post TGE
     ********************************************************/

    /**
     * Claim tokens for the user from airdrop
     * @dev Only callable after TGE
     */
    function claimAirdrop() external nonReentrant onlyPostTGE {
        address beneficiary = msg.sender;
        if (airdrop[beneficiary] > 0) {
            if (_getToken().transfer(beneficiary, airdrop[beneficiary])) {
                emit AirdropClaim(beneficiary, airdrop[beneficiary]);
                airdrop[beneficiary] = 0;
                return;
            }
        }
        revert UnableToAirdropToken(beneficiary, airdrop[beneficiary]);
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
    function addUserToAirdrop(
        address[] memory beneficaryList,
        uint256[] memory amountList
    ) external nonReentrant onlyOwner onlyPreTGE {
        if (beneficaryList.length != amountList.length) {
            revert BeneficiaryAmountMismatch(
                beneficaryList.length,
                amountList.length
            );
        }
        for (uint256 i = 0; i < beneficaryList.length; i += 1) {
            airdrop[beneficaryList[i]] += amountList[i];
        }
    }

    /*******************************************************
     * External view
     ********************************************************/

    /**
     * Balance of airdrop for the given account
     * @param account Address of the account
     */
    function balanceAirdrop(address account) external view returns (uint256) {
        return airdrop[account];
    }

    /*******************************************************
     * Internal View
     ********************************************************/

    /**
     * Get ON token instance
     */
    function _getToken() internal view returns (IONToken) {
        return IONToken(onVestingMain.getTokenAddress());
    }
}
