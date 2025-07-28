// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ONCommon.sol";
import "./ONVestingSubBase.sol";

/**
 * @title Orochi Network Vesting Sub
 */
contract ONVestingSub is ONVestingSubBase, ReentrancyGuard {
    /*******************************************************
     * External Only Once
     ********************************************************/

    /**
     * Init method
     * @param onVestingMainAddress The address of the main vesting contract
     * @param vestingTerm Vesting term
     */
    function init(
        address onVestingMainAddress,
        VestingTerm memory vestingTerm
    ) external onlyOnce nonReentrant returns (bool) {
        return _init(onVestingMainAddress, vestingTerm);
    }

    /*******************************************************
     * External Only Beneficiary, after TGE
     ********************************************************/

    /**
     * Claim tokens for the sender
     * @dev Only callable after TGE
     */
    function claim() external nonReentrant onlyPostTGE onlyBeneficiary {
        _claim(_getBeneficiary());
    }

    /**
     * If token is vested but stuck in the smart contract
     * this method allow to withdraw all of them
     * @dev Only callable after fully vested
     */
    function emergency() external nonReentrant onlyPostTGE onlyBeneficiary {
        _emergency();
    }

    /*******************************************************
     * External Only Beneficiary
     ********************************************************/

    /**
     * Transfer vesting contract to new owner
     * @param beneficiaryNew New vesting contract owner
     */
    function transferVestingContract(
        address beneficiaryNew
    ) external nonReentrant onlyBeneficiary {
        _transferVestingContract(beneficiaryNew);
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Get beneficiary address
     */
    function getBeneficiary() external view returns (address) {
        return _getBeneficiary();
    }

    /**
     * Get start of vesting time
     */
    function getTimeStart() external view returns (uint64) {
        return _timeStart();
    }

    /**
     * Get end of vesting time
     */
    function getTimeEnd() external view returns (uint64) {
        return _timeEnd();
    }

    /**
     * Claimable token balance of the given account
     */
    function getClaimableBalance() external view returns (uint256) {
        return _getClaimableBalance();
    }

    /**
     * Vesting balance
     */
    function getRemainingBalance() external view returns (uint256) {
        return _getRemainingBalance();
    }

    /**
     * Get vesting schedule of the given account
     */
    function getVestingDetail() external view returns (VestingDetail memory) {
        return _getVestingDetail();
    }
}
