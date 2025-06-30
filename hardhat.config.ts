import fs from 'fs';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { env } from './env';

if (fs.existsSync('./typechain-types')) {
  const dir = fs.opendirSync(`${__dirname}/tasks`);
  for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
    if (entry.name.toLowerCase().includes('.ts')) {
      require(`./tasks/${entry.name.replace(/\.ts$/gi, '')}`);
    }
  }
}

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.26',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    local: {
      url: env.LOCAL_RPC,
      chainId: 911,
    },
    testnetU2U: {
      url: 'https://rpc-nebulas-testnet.uniultra.xyz/',
      chainId: 2484,
    },
    testnetMonad: {
      url: 'https://testnet-rpc.monad.xyz',
      chainId: 10143,
    },
  },
  etherscan: {
    apiKey: {
      testnetU2U: 'abc',
    },
    customChains: [
      {
        network: 'testnetU2U',
        chainId: 2484,
        urls: {
          apiURL: 'https://testnet.u2uscan.xyz/api',
          browserURL: 'https://testnet.u2uscan.xyz',
        },
      },
    ],
  },
};

export default config;
