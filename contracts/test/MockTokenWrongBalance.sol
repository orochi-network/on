// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockTokenWrongBalance
 */
contract MockTokenWrongBalance is ERC20 {
    /**
     * Deploy and initialize the MockToken contract
     */
    constructor() ERC20("Mock Token Wrong Balance", "MWB") {}

    /*******************************************************
     * Owner
     ********************************************************/

    /**
     * Mock balanceOf which is alway return wrong
     */
    function balanceOf(
        address _account
    ) public pure override returns (uint256) {
        abi.encode(_account);
        return 1;
    }
}
