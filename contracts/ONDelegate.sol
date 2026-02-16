// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ONCommon.sol";

/**
 * @title Orochi Network Delegate
 */
contract ONDelegate is Ownable {
    // Use SafeERC20 for IERC20
    using SafeERC20 for IERC20;

    // All possible errors
    error InvalidDelegatedAmount(address delegator, uint256 amount);
    error InvalidDelegator(address delegator);
    error LockedDelegation(address delegator, uint256 unlockTime);
    error InvalidAmount();
    error InvalidBeneficiary(address beneficiary);
    error InvalidAddress(address checkAddress);

    // All events
    event NewDelegation(address indexed delegator, uint256 indexed amount);
    event DelegatorAdded(address indexed delegator);
    event DelegatorRemoved(address indexed delegator);
    event Refund(address indexed delegator, uint256 indexed amount);
    event Complete(address indexed delegator, address indexed beneficiary, uint256 indexed amount);

    // Whitelist check modifier
    modifier onlyWhitelist(address delegator) {
        if (!delegation[delegator].whitelist) {
            //  If whitelist == false => Invalid
            revert InvalidDelegator(delegator);
        }
        _;
    }

    // Only allow unlocked delegation to be withdraw
    modifier onlyUnlocked(address delegator) {
        if (block.timestamp < delegation[delegator].unlockTime) {
            revert LockedDelegation(delegator, delegation[delegator].unlockTime);
        }
        _;
    }

    // Delegation data record
    struct DelegationRecord {
        bool whitelist;
        uint64 unlockTime;
        uint256 amount;
    }

    // Store delegation data
    mapping(address => DelegationRecord) private delegation;

    // Token instance
    IERC20 private immutable onToken;

    /*******************************************************
     * Constructor
     ********************************************************/

    /**
     * Constructor
     * @param onTokenAddress The address of the ON Token contract
     */
    constructor(address onTokenAddress) Ownable(msg.sender) {
        if (onTokenAddress == address(0)){
            revert InvalidAddress(onTokenAddress);
        }
        onToken = IERC20(onTokenAddress);
    }

    /*******************************************************
     * Internal methods
     ********************************************************/

    /**
     * Delegator can delegate their token to Orochi Network
     * @param delegator Address of delegator wallet
     * @param amount Amount to ON Token
     */
    function _delegate(address delegator, uint256 amount, uint256 lockDuration) internal {
        uint256 allowance = onToken.allowance(delegator, address(this));
        // If allowance greater or equal to amount
        // an amount greater than zero
        // We're going to perform the delegation
        if (allowance >= amount && amount > 0) {
            // Transfer the token to ONDelegate address
            onToken.safeTransferFrom(delegator, address(this), amount);
            // Increase delegated amount of delegator
            delegation[delegator].amount += amount;
            delegation[delegator].unlockTime = uint64(block.timestamp + lockDuration);
            // Emit new event of success delegation
            emit NewDelegation(delegator, amount);
            return;
        }
        // Token's delegator didn't delegate the token to ONDelegate
        revert InvalidDelegatedAmount(delegator, allowance);
    }

    /*
    * Transfer method that allow us to transfer and refund token
    * @param delegator Address of delegator
    * @param beneficiary Address that receive the token
    * @param amount Token amount was delegated
    */
    function _transfer(address delegator, address beneficiary, uint256 amount) internal {
        if (amount == 0 || amount > delegation[delegator].amount) {
            revert InvalidAmount();
        }
        // Transfer given amount of token to beneficiary
        onToken.safeTransfer(beneficiary, amount);
        delegation[delegator].amount -= amount;
    }

    /**
     * Method to update whitelist status
     * @param listDelegator An array of delegator addresses
     * @param newWhitelistStatus New whitelist status to be update
     * `newWhitelistStatus` true: add to whitelist otherwise remove
     */
    function _delegatorUpdate(address[] calldata listDelegator, bool newWhitelistStatus) internal {
        address delegator;
        for (uint256 i = 0; i < listDelegator.length; i += 1) {
            delegator = listDelegator[i];
            if (delegation[delegator].whitelist != newWhitelistStatus) {
                delegation[delegator].whitelist = newWhitelistStatus;
                if (newWhitelistStatus) {
                    emit DelegatorAdded(delegator);
                } else {
                    emit DelegatorRemoved(delegator);
                }
            }
        }
    }

    /*******************************************************
     * External whitelisted delegator
     ********************************************************/

    /**
     * Anyone would able to delegate to Orochi Network
     * @dev `lockDuration` will be set to `180 days` if value not set.
     */
    function delegate(uint256 amount, uint256 lockDuration) external onlyWhitelist(msg.sender) {
        // Delegate a given amount of token
        _delegate(msg.sender, amount, lockDuration > 0 ? lockDuration : 180 days);
    }

    /**
     * Quick method to delegate all token of given address
     * @dev `lockDuration` will be set to `180 days` if value not set.  
     */
    function delegateAll(uint256 lockDuration) external onlyWhitelist(msg.sender) {
        // Delegate all token of given delegator
        _delegate(msg.sender, onToken.balanceOf(msg.sender), lockDuration > 0 ? lockDuration : 180 days);
    }

    /**
     * Allow delegator to withdraw all of their token if
     * delegation is unlocked
     */
    function withdraw() external onlyWhitelist(msg.sender) onlyUnlocked(msg.sender) {
        address delegator = msg.sender;
        uint256 amount = delegation[delegator].amount;
        _transfer(delegator, delegator, amount);
        emit Refund(delegator, amount);
    }

    /*******************************************************
     * External Owner
     ********************************************************/

    /**
     * Add delegators by a given list
     */
    function delegatorAdd(address[] calldata listDelegator) external onlyOwner {
        _delegatorUpdate(listDelegator, true);
    }

    /**
     * Remove delegators by a given list
     */
    function delegatorRemove(address[] calldata listDelegator) external onlyOwner {
        _delegatorUpdate(listDelegator, false);
    }

    /**
     * Allow owner to trigger refund sooner
     */
    function refund(address delegator, uint256 amount) external onlyOwner onlyWhitelist(delegator) {
        _transfer(delegator, delegator, amount);
        emit Refund(delegator, amount);
    }

    /**
     * We complete a given delegation
     */
    function complete(address delegator, address beneficiary, uint256 amount)
        external
        onlyOwner
        onlyWhitelist(delegator)
    {
        if (delegator == beneficiary) {
            revert InvalidBeneficiary(beneficiary);
        }
        _transfer(delegator, beneficiary, amount);
        emit Complete(delegator, beneficiary, amount);
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Get delegated amount of given address
     */
    function getDelegation(address delegator)
        external
        view
        returns (bool whitelist, uint64 unlockTime, uint256 amount)
    {
        DelegationRecord memory record = delegation[delegator];
        whitelist = record.whitelist;
        unlockTime = record.unlockTime;
        amount = record.amount;
    }

    /**
     * Get token address
     */
    function getToken() external view returns (address) {
        return address(onToken);
    }
}
