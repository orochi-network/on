/* eslint-disable no-await-in-loop */
import '@nomicfoundation/hardhat-ethers';
import { Wallet } from 'ethers';
import { task } from 'hardhat/config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import EncryptionKey from '../helpers/encryption';
import { getWallet } from '../helpers/wallet';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export const tgeTime = '1750834800'; // 2025-06-25 14:00:00 GMT+7

task('deploy:vesting', 'Deploy vesting & token contract').setAction(
  async (_taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const { chainId } = await ethers.provider.getNetwork();
    const account = await getWallet(hre, chainId);
    const block = await hre.ethers.provider.getBlock('latest');
    if (!account.provider) {
      throw new Error('Invalid provider');
    }
    if (!block) throw new Error('Block not found');

    const ONFactory = await ethers.getContractFactory(
      'OrochiNetworkToken',
      account
    );
    const VestingFactory = await ethers.getContractFactory(
      'OrochiNetworkVesting',
      account
    );
    const ONToken = await (
      await ONFactory.deploy('Test ON', 'TON')
    ).waitForDeployment();
    const ONTokenAddress = await ONToken.getAddress();
    console.log('ON Token was deployed to', ONTokenAddress);
    const Vesting = await VestingFactory.deploy(ONTokenAddress, tgeTime);
    const VestingAddress = await Vesting.getAddress();
    console.log('Vesting contract was deployed to', VestingAddress);

    await (await ONToken.transferOwnership(VestingAddress)).wait();
    console.log('Successfully transfer ONToken ownership to Vesting contract');
  }
);
