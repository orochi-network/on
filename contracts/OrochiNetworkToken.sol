// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Orochi Network Token
 */
contract OrochiNetworkToken is ERC20, Ownable {
    /*******************************************************
     * Constructor
     ********************************************************/

    /**
     * Deploy and initialize the ONProver contract
     * @param name Token name
     * @param symbol Token symbol
     */
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /*******************************************************
     * Owner
     ********************************************************/

    function mint(address to, uint256 amount) public onlyOwner returns (bool) {
        _mint(to, amount);
        return true;
    }
}
