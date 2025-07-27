// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

/**
 * @title Orochi Network Vesting Main Base Interface
 */
interface ONVestingSubBaseInterface {
    // Errors
    error UnableToInitTwice();
    error InvalidBeneficiary(address beneficiary);
    error UnableToCallEmergency();
    error InvalidVestingSchedule(address beneficiary);
    error NoClaimableToken(address beneficiary, uint256 milestone);
    error InsufficientBalance(
        address beneficiary,
        uint256 balance,
        uint256 remaining
    );
    error UnableToRelease(
        address beneficiary,
        uint256 milestone,
        uint256 amount
    );
    error InvalidVestingTerm(address beneficiary);

    // Events
    event TransferVestingContract(address indexed from, address indexed to);
    event EmergencyWithdraw(address indexed to, uint256 value);
    event TokenClaimed(
        address indexed beneficiary,
        uint256 indexed milestone,
        uint256 indexed amount
    );
    event UnlockAtTGE(address indexed beneficiary, uint256 indexed amount);
}
