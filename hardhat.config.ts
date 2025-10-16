import fs from "fs";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-viem";
import "./scripts/env";
import dotenv from "dotenv";

dotenv.config();

if (fs.existsSync("./typechain-types")) {
  const dir = fs.opendirSync(`${__dirname}/tasks`);
  for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
    if (entry.name.toLowerCase().includes(".ts")) {
      // eslint-disable-next-line import/no-dynamic-require
      require(`./tasks/${entry.name.replace(/\.ts$/gi, "")}`);
    }
  }
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
};

export default {
  ...config,
  networks: {
    local: {
      url: "http://localhost:8545",
      chainId: 911,
    },
    hardhat: {
      chainId: 911,
    },
    ethereum: {
      url: process.env.RPC_ETHEREUM_MAINNET ?? "http://localhost:8545",
      chainId: 1,
    },
    sepolia: {
      url: process.env.RPC_ETHEREUM_SEPOLIA ?? "http://localhost:8545",
      chainId: 11155111,
    },
  },
} as HardhatUserConfig;
