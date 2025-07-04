/* eslint-disable no-await-in-loop */
import '@nomicfoundation/hardhat-ethers';
import fs from 'fs';
import { task } from 'hardhat/config';
import path from 'path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DEPLOYED_CONTRACT_RESULT_PATH } from '../helpers/const';
import { getWallet } from '../helpers/wallet';

export const tgeTime = 1751353200; // 2025-01-07 14:00:00 GMT+7

task('deploy:vesting', 'Deploy vesting & token contract').setAction(
  async (_taskArgs: any, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre;
    const { chainId, name } = await ethers.provider.getNetwork();
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

    const deploymentJson = fs.existsSync(DEPLOYED_CONTRACT_RESULT_PATH)
      ? JSON.parse(fs.readFileSync(DEPLOYED_CONTRACT_RESULT_PATH).toString())
      : {};
    deploymentJson[name] = {
      OrochiNetworkToken: ONTokenAddress,
      VestingContract: VestingAddress,
    };

    const resultDir = path.dirname(DEPLOYED_CONTRACT_RESULT_PATH);
    fs.mkdirSync(resultDir, { recursive: true });

    fs.writeFileSync(
      DEPLOYED_CONTRACT_RESULT_PATH,
      JSON.stringify(deploymentJson)
    );
  }
);
