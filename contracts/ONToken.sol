// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Orochi Network Token
 */
contract OrochiNetworkToken is ERC20, Ownable {
    error AlreadyMinted(uint256 totalSupply);

    /**
     * Deploy and initialize the Orochi Network Token
     * @param name Token name
     * @param symbol Token symbol
     */
    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) Ownable(msg.sender) {}

    /*******************************************************
     * Owner
     ********************************************************/

    /**
     * Only allow owner to mint
     * @dev Owner will be Orochi Network Vesting Main
     */
    function mint() external onlyOwner returns (bool) {
        if (totalSupply() > 0) {
            revert AlreadyMinted(totalSupply());
        }
        _mint(owner(), 700000000 ether);
        return true;
    }
}
