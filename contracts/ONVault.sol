// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ONVaultInterface.sol";

/**
 * @title Orochi Network Vault
 * @dev Secure token vault with owner (multisig) and user roles.
 * Owner controls day-to-day token operations; user can reclaim funds after expiry.
 */
contract ONVault is Ownable, ReentrancyGuard, ONVaultInterface {
    using SafeERC20 for IERC20;

    // Duration constraints
    uint256 public constant MIN_EXTEND_DURATION = 30 days;
    uint256 public constant MAX_EXTEND_DURATION = 365 days;

    // State variables
    address private user;
    uint256 private expireTime;

    // Token address, default is ON Token on Ethereum mainnet
    // https://etherscan.io/address/0x33f6BE84becfF45ea6aA2952d7eF890B44bFB59d
    address private tokenAddress = address(0x33f6BE84becfF45ea6aA2952d7eF890B44bFB59d);

    // Access control modifiers
    modifier onlyUser() {
        if (msg.sender != user) {
            revert InvalidUser(msg.sender);
        }
        _;
    }

    modifier onlyNotExpired() {
        if (block.timestamp > expireTime) {
            revert ExpiredContract(expireTime, block.timestamp);
        }
        _;
    }

    /**
     * @param ownerAddress Multisig wallet address (owner)
     * @param userAddress User who can trigger emergency / extend time
     */
    constructor(address ownerAddress, address userAddress) Ownable(ownerAddress) {
        if (userAddress == address(0)) {
            revert InvalidAddress(userAddress);
        }
        if (ownerAddress == userAddress) {
            revert InvalidOwnerAndUser(ownerAddress, userAddress);
        }
        user = userAddress;
        expireTime = block.timestamp + 90 days;
    }

    /**
     * @dev Override to prevent transferring ownership to the user address
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        if (newOwner == user) {
            revert InvalidOwnerAndUser(newOwner, user);
        }
        super.transferOwnership(newOwner);
    }

    /*******************************************************
     * Owner functions
     ********************************************************/

    /**
     * @dev Set the active token address
     * @param _tokenAddress Token address to set
     */
    function setToken(address _tokenAddress) external onlyOwner onlyNotExpired {
        if (_tokenAddress == address(0)) {
            revert InvalidTokenAddress(_tokenAddress);
        }
        tokenAddress = _tokenAddress;
        emit TokenSet(_tokenAddress);
    }

    /**
     * @dev Transfer the currently set token to given address
     * @param to Recipient address
     * @param value Amount to transfer
     */
    function transfer(address to, uint256 value) external onlyOwner onlyNotExpired nonReentrant {
        if (to == address(0)) {
            revert InvalidBeneficiary(to);
        }
        if (value == 0) {
            revert InvalidAmount();
        }
        IERC20(tokenAddress).safeTransfer(to, value);
        emit TokenTransferred(tokenAddress, to, value);
    }

    /*******************************************************
     * User functions
     ********************************************************/

    /**
     * @dev Emergency withdrawal of full balance after expiry
     * @param _tokenAddress Token to withdraw (can differ from active token for recovery)
     * @param beneficiary Address to receive the funds
     */
    function emergency(address _tokenAddress, address beneficiary) external onlyUser nonReentrant {
        if (block.timestamp <= expireTime) {
            revert NotExpired(expireTime, block.timestamp);
        }
        if (_tokenAddress == address(0)) {
            revert InvalidTokenAddress(_tokenAddress);
        }
        if (beneficiary == address(0)) {
            revert InvalidBeneficiary(beneficiary);
        }

        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));

        if (balance == 0) {
            revert InvalidAmount();
        }

        IERC20(_tokenAddress).safeTransfer(beneficiary, balance);
        emit Emergency(_tokenAddress, beneficiary, balance);
    }

    /**
     * @dev Extend the vault's expiration time
     * @param duration Duration to add (must be between MIN and MAX)
     */
    function extendExpireTime(uint256 duration) external onlyUser {
        if (duration < MIN_EXTEND_DURATION || duration > MAX_EXTEND_DURATION) {
            revert InvalidDuration(duration);
        }
        expireTime = block.timestamp + duration;
        emit ExpireTimeExtended(expireTime);
    }

    /*******************************************************
     * View functions
     ********************************************************/

    function getUser() external view returns (address) {
        return user;
    }

    function getExpireTime() external view returns (uint256) {
        return expireTime;
    }

    function getTokenAddress() external view returns (address) {
        return tokenAddress;
    }
}
