import fs from 'fs';
import { config } from 'dotenv';
import { isAddress } from 'ethers';

config();

const OROCHI_CONFIGURATION = {
  LOCAL_RPC: '',
  OROCHI_ENCRYPTED_PASSPHRASE: '',
  OROCHI_OWNER: '',
} as const;

type TAlterConfig<T extends Record<string, string>> = {
  [K in keyof T]: T[K] extends 'false' | 'true' ? boolean : string;
};

export type TEnvironment = TAlterConfig<typeof OROCHI_CONFIGURATION>;

if (!fs.existsSync(`${__dirname}/.env`)) {
  throw new Error('.env file not found');
}

function initEnv() {
  const keys = Object.keys(OROCHI_CONFIGURATION);
  const cleaned: any = {};
  for (let i = 0; i < keys.length; i += 1) {
    const k: keyof TEnvironment = keys[i] as keyof TEnvironment;
    const v = process.env[k] || OROCHI_CONFIGURATION[k];
    cleaned[k] = v.trim();
  }
  if (!isAddress(cleaned['OROCHI_OWNER'])) {
    throw new Error('Invalid owner address');
  }
  return cleaned;
}

const rawEnv: TEnvironment = initEnv();

function load(): any {
  const cleaned = initEnv();
  cleaned.LOCAL_RPC = cleaned.LOCAL_RPC || 'http://127.0.0.1:8545';
  const keys = Object.keys(OROCHI_CONFIGURATION);

  for (let i = 0; i < keys.length; i += 1) {
    const k: keyof TEnvironment = keys[i] as keyof TEnvironment;
    if (typeof process.env[k] !== 'undefined') {
      delete process.env[k];
    }
  }
  return cleaned;
}

export const env: TEnvironment = load();
