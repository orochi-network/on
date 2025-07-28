import { Client, createPublicClient, getContract, Hex, http } from "viem";
import { localhost } from "viem/chains";
import { ContractTypesMap } from "hardhat/types/artifacts";
import { abi as abiVestingMain } from "../artifacts/contracts/ONVestingMain.sol/ONVestingMain.json";
import { abi as abiVestingSub } from "../artifacts/contracts/ONVestingSub.sol/ONVestingSub.json";
import { abi as abiAirdrop } from "../artifacts/contracts/ONAirdrop.sol/ONAirdrop.json";
import { abi as abiToken } from "../artifacts/contracts/ONToken.sol/OrochiNetworkToken.json";

type HexString = `0x${string}`;

const VESTING_MAIN_ADDRESS: HexString =
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const AIRDROP_ADDRESS: HexString = "0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9";

const getVestingSubContract = async (
  index: bigint,
  client: Client
): Promise<ContractTypesMap["ONVestingSub"]> => {
  // Get contract main instance
  const contractMain: ContractTypesMap["ONVestingMain"] = getContract({
    abi: abiVestingMain,
    address: VESTING_MAIN_ADDRESS,
    client,
  }) as any;

  // Get sub contract instance based on result of main contract
  return getContract({
    abi: abiVestingSub,
    address: await contractMain.read.getVestingContractAddress([index]),
    client,
  }) as any;
};

(async () => {
  const client = createPublicClient({
    chain: localhost,
    transport: http(),
  });

  const vestingMain: ContractTypesMap["ONVestingMain"] = getContract({
    abi: abiVestingMain,
    address: VESTING_MAIN_ADDRESS,
    client,
  }) as any;

  const airdrop: ContractTypesMap["ONAirdrop"] = getContract({
    abi: abiAirdrop,
    address: AIRDROP_ADDRESS,
    client,
  }) as any;

  const total = await vestingMain.read.getVestingContractTotal();

  const information = await vestingMain.read.getVestingDetailList([0n, total]);

  console.log(information);

  const token: ContractTypesMap["OrochiNetworkToken"] = getContract({
    abi: abiToken,
    address: await vestingMain.read.getTokenAddress(),
    client,
  }) as any;

  console.log("Token info:", {
    address: token.address,
    name: await token.read.name(),
    symbol: await token.read.symbol(),
    totalSupply: await token.read.totalSupply(),
  });

  const vestingSub = await getVestingSubContract(0n, client);
  console.log(await vestingSub.read.getClaimableBalance());
  console.log(await vestingSub.read.getRemainingBalance());

  /*
    // Example call write method
    const txHash = await vestingSub.write.claim();
    console.log("Transaction hash:", txHash);
  */

  // Check eligibility for airdrop
  console.log(
    "Airdrop Balance of 0x70997970C51812dc3A010C7d01b50e0d17dc79C8:",
    await airdrop.read.getAirdropBalance([
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    ])
  );

  /*
    // Example airdrop balance
    const txHash = await airdrop.write.claim();
    console.log("Transaction hash:", txHash);
  */
})();
