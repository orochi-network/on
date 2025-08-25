import { Client, createPublicClient, createWalletClient, getContract, Hex, http, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { ContractTypesMap } from "hardhat/types/artifacts";
import { abi as abiVestingMain } from "../artifacts/contracts/ONVestingMain.sol/ONVestingMain.json";
import { abi as abiVestingSub } from "../artifacts/contracts/ONVestingSub.sol/ONVestingSub.json";
import { abi as abiAirdrop } from "../artifacts/contracts/ONAirdrop.sol/ONAirdrop.json";
import { abi as abiToken } from "../artifacts/contracts/ONToken.sol/OrochiNetworkToken.json";
import { privateKeyToAccount } from "viem/accounts";

type HexString = `0x${string}`;

const VESTING_MAIN_ADDRESS: HexString =
  "0xBd30FE3632367F22c1E582376594865d477A11e7";

const AIRDROP_ADDRESS: HexString = "0x47844aCcd37D9714302D2cd6a631c975f280c851";

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

  const account = privateKeyToAccount('0x6e2bdbad67f9f86610d86aa3f6f923958806c4972a80af573756d2c4449c8775')

  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  const vestingMain: ContractTypesMap["ONVestingMain"] = getContract({
    abi: abiVestingMain,
    address: VESTING_MAIN_ADDRESS,
    client,
  }) as any;



  const tx = await vestingMain.write.transfer(['0x3FB52F41bd66ec0b59419F95f2612341262618ee', parseEther('1')]);
  console.log('Tx hash:', tx);

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
