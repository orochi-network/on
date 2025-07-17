// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockTokenNoTransfer
 */
contract MockTokenNoTransfer is ERC20 {
    IERC20 originalToken;

    /**
     * Deploy and initialize the MockToken contract
     */
    constructor(address token) ERC20("Mock Token", "Mock") {
        originalToken = IERC20(token);
    }

    /*******************************************************
     * Owner
     ********************************************************/

    /**
     * Mock transfer which is alway false
     */
    function transfer(
        address _to,
        uint256 _value
    ) public override returns (bool) {
        return false;
    }

    /**
     * Mock balanceOf which is alway return wrong
     */
    function balanceOf(address account) public view override returns (uint256) {
        return originalToken.balanceOf(account);
    }
}
