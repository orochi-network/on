/* eslint-disable no-await-in-loop */
import '@nomicfoundation/hardhat-ethers';
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getWallet } from '../helpers/wallet';
import { tgeTime } from './deploy-vesting';
import { OrochiNetworkVesting } from '../typechain-types';
import { isAddress } from 'ethers';

const VESTING_CONTRACT = '0x03dd172D45a9a8de308aE2239FAfEA778CdBf8B7';
const ONE_HOUR_IN_SEC = 60 * 60;
const ONE_DAY_IN_SEC = 24 * ONE_HOUR_IN_SEC;
const UNIT = 10n ** 18n;
const ADDRESS_TO_ADD = '0xe3DEAA98BA4c4D2C6E1ae190C1281aa4E0045969';

task('add:vesting', 'Deploy vesting & token contract').setAction(
  async (_taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const { chainId } = await ethers.provider.getNetwork();
    const account = await getWallet(hre, chainId);
    const block = await hre.ethers.provider.getBlock('latest');
    if (!account.provider) {
      throw new Error('Invalid provider');
    }
    if (!block) throw new Error('Block not found');
    if (!isAddress(VESTING_CONTRACT))
      throw new Error('Invalid vesting address');

    // Get Vesting contract
    const Vesting = (await hre.ethers.getContractAt(
      'OrochiNetworkVesting',
      VESTING_CONTRACT,
      account
    )) as OrochiNetworkVesting;

    const start = block.timestamp + ONE_HOUR_IN_SEC; // Vesting begins in  h
    const duration = ONE_DAY_IN_SEC; // Each milestone = 1 day
    const end = start + duration * 5; // Vesting ends in 5 days
    const unlocked = UNIT * 10n; // 10 ON unlocked TGE
    const total = UNIT * 1000n; // Total grant = 1000 ON
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

    // Transfer ON Token ownership to vesting contract

    console.log('Successfully add', ADDRESS_TO_ADD, 'with term', vestingTerm);
  }
);
