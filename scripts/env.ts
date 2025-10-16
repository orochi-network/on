declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    RPC_ETHEREUM_MAINNET: string;
    RPC_ETHEREUM_SEPOLIA: string;
    KMS_WALLET_ADDRESS: string;
  }
}
