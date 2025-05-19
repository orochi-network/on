// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOrochiNetworkToken is IERC20 {
    function mint(address to, uint256 amount) external returns (bool);
}
