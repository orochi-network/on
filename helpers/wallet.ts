/* eslint-disable no-await-in-loop */
import '@nomicfoundation/hardhat-ethers';
import { HDNodeWallet, Wallet } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { env } from '../env';
import EncryptionKey from './encryption';

export async function getWallet(
  hre: HardhatRuntimeEnvironment,
  chainId: bigint
): Promise<HDNodeWallet> {
  if (chainId === 911n) {
    const wallet = (await hre.ethers.getSigners())[0] as any;
    console.log(
      `ChainID: ${chainId.toString().padEnd(16, ' ')} Address: ${
        wallet.address
      } Path: m/44'/60'/0'/0/${chainId}`
    );
    return wallet;
  } else {
    if (!hre.network.config.chainId) {
      throw new Error('Invalid chainId');
    }

    const provider = hre.ethers.provider;
    const aes = await EncryptionKey.getInstance();
    const masterWallet = Wallet.fromPhrase(
      aes
        .decrypt(Buffer.from(env.OROCHI_ENCRYPTED_PASSPHRASE, 'base64'))
        .toString('utf-8'),
      hre.ethers.provider
    );
    console.log(
      'Recovered master wallet:',
      masterWallet.address,
      'path:',
      masterWallet.path
    );
    const wallet = masterWallet.deriveChild(chainId);
    console.log(
      `--------------------
Deployer's Wallet > ChainID: ${chainId.toString().padEnd(16, ' ')} Address: ${
        wallet.address
      } Path: ${wallet.path}`
    );
    return wallet.connect(provider);
  }
}
