// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

/**
 * @title Orochi Network Vesting Main Base Interface
 */
interface ONVestingMainBaseInterface {
    // Errors
    error UnableToAddNewVestingContract(address beneficiary);
    error TGETimeMustBeInTheFuture(uint256 timestamp);
    error InvalidOffsetOrLimit(uint256 offset, uint256 limit);
    error UnableToTransfer(address to, uint256 value);

    // Events
    event TransferToken(address indexed to, uint256 value);
    event AddNewVestingContract(
        uint256 indexed index,
        address vestingContract,
        address indexed beneficiary
    );
    event SetImplementation(address indexed implementation);
    event SetTokenAddress(address indexed tokenAddress);
    event SetTimeTGE(uint256 indexed timestampTGE);
}
