// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

/**
 * @title Orochi Network Vault Interface
 */
interface ONVaultInterface {
    // Custom errors
    error InvalidUser(address caller);
    error InvalidTokenAddress(address tokenAddress);
    error TokenNotSet();
    error InvalidAmount();
    error InvalidBeneficiary(address beneficiary);
    error NotExpired(uint256 expireTime, uint256 currentTime);
    error InvalidDuration(uint256 duration);
    error InvalidAddress(address addr);

    // Events
    event TokenSet(address indexed tokenAddress);
    event TokenTransferred(address indexed tokenAddress, address indexed to, uint256 value);
    event Emergency(address indexed tokenAddress, address indexed beneficiary, uint256 value);
    event ExpireTimeExtended(uint256 newExpireTime);

    // Owner functions
    function setToken(address tokenAddress) external;
    function transfer(address to, uint256 value) external;

    // User functions
    function emergency(address tokenAddress, address beneficiary) external;
    function extendExpireTime(uint256 duration) external;

    // View functions
    function getUser() external view returns (address);
    function getExpireTime() external view returns (uint256);
    function getTokenAddress() external view returns (address);
}
