/* eslint-disable no-await-in-loop */
import '@nomicfoundation/hardhat-ethers';
import fs from 'fs';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getWallet } from '../helpers/wallet';
import { tgeTime } from './deploy-vesting';
import { OrochiNetworkVesting } from '../typechain-types';
import { isAddress } from 'ethers';
import { DEPLOYED_CONTRACT_RESULT_PATH } from '../helpers/const';

const ONE_HOUR_IN_SEC = 60 * 60;
const ONE_DAY_IN_SEC = 24 * ONE_HOUR_IN_SEC;
const UNIT = 10n ** 18n;

// Vesting config
const ADDRESS_TO_ADD = '0xe3DEAA98BA4c4D2C6E1ae190C1281aa4E0045969';
const start = tgeTime + ONE_HOUR_IN_SEC; // Vesting begins in
const duration = ONE_DAY_IN_SEC; // Each milestone = 1 day
const end = start + duration * 5; // Vesting ends in 5 days
const unlocked = UNIT * 10n; // 10 ON unlocked TGE
const total = UNIT * 1000n; // Total grant = 1000 ON

task('add:vesting', 'Deploy vesting & token contract').setAction(
  async (_taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const { chainId, name } = await ethers.provider.getNetwork();

    const deploymentJson = fs.existsSync(DEPLOYED_CONTRACT_RESULT_PATH)
      ? JSON.parse(fs.readFileSync(DEPLOYED_CONTRACT_RESULT_PATH).toString())
      : {};
    if (
      deploymentJson?.[name]?.OrochiNetworkToken &&
      deploymentJson?.[name]?.VestingContract
    ) {
      const account = await getWallet(hre, chainId);
      const VestingContract = deploymentJson?.[name]?.VestingContract;
      const block = await hre.ethers.provider.getBlock('latest');
      if (!account.provider) {
        throw new Error('Invalid provider');
      }
      if (!block) throw new Error('Block not found');
      if (!isAddress(VestingContract))
        throw new Error('Invalid vesting address');

      // Get Vesting contract
      const Vesting = (await hre.ethers.getContractAt(
        'OrochiNetworkVesting',
        VestingContract,
        account
      )) as OrochiNetworkVesting;

      const milestoneRelease = (total - unlocked) / 18n;

      const vestingTerm = {
        beneficiary: ADDRESS_TO_ADD,
        start,
        duration,
        end,
        unlocked,
        total,
      };

      await (await Vesting.addVestingTerm(vestingTerm)).wait();

      console.log(
        'Successfully add',
        ADDRESS_TO_ADD,
        'with term',
        vestingTerm,
        'and milsestone release',
        milestoneRelease
      );
    } else {
      throw new Error(`Missing ON Token/ Vesting contract in ${name}`);
    }
  }
);
