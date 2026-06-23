// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Orochi Network Customized Vesting
 * @notice Minimal vesting "main" that exposes only what `ONVestingSub` reads:
 *         the ON token address, the TGE timestamp, and whether TGE has started.
 *         The ON token is fixed. The owner may set the TGE time freely; to seal
 *         it permanently, renounce ownership.
 * @dev    `ONVestingSub` is deployed standalone, initialised against this
 *         contract, and funded by transferring the ON token directly to it.
 *         There is no clone factory and no implementation address.
 */
contract ONCustomizedVesting is Ownable {
    /// @notice The ON token that `ONVestingSub` releases.
    address public constant TOKEN =
        0x33f6BE84becfF45ea6aA2952d7eF890B44bFB59d;

    /// @dev TGE timestamp.
    uint256 private timeTGE;

    event SetTimeTGE(uint256 indexed timestampTGE);

    /**
     * @param timestampTGE Initial TGE timestamp.
     */
    constructor(uint256 timestampTGE) Ownable(msg.sender) {
        timeTGE = timestampTGE;
        emit SetTimeTGE(timestampTGE);
    }

    /**
     * @notice Set the TGE time. Callable by the owner at any time; renounce
     *         ownership to seal it permanently.
     * @param timestampTGE New TGE timestamp.
     */
    function setTimeTGE(uint256 timestampTGE) external onlyOwner {
        timeTGE = timestampTGE;
        emit SetTimeTGE(timestampTGE);
    }

    /**
     * @notice ON token address consumed by `ONVestingSub`.
     */
    function getTokenAddress() external pure returns (address) {
        return TOKEN;
    }

    /**
     * @notice TGE timestamp consumed by `ONVestingSub`.
     */
    function getTimeTGE() external view returns (uint256) {
        return timeTGE;
    }

    /**
     * @notice Whether TGE has started, consumed by `ONVestingSub`.
     */
    function isTGE() external view returns (bool) {
        return block.timestamp >= timeTGE;
    }
}
