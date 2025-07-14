import { createPublicClient, getContract, http } from "viem";
import { localhost } from "viem/chains";
import { ContractTypesMap } from "hardhat/types/artifacts";
import { abi as abiVestingMain } from "../artifacts/contracts/ONVestingMain.sol/ONVestingMain.json";
import { abi as abiToken } from "../artifacts/contracts/ONToken.sol/OrochiNetworkToken.json";

(async () => {
  const client = createPublicClient({
    chain: localhost,
    transport: http(),
  });

  const token: ContractTypesMap["OrochiNetworkToken"] = getContract({
    abi: abiToken,
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    client,
  }) as any;

  console.log("Token info:", {
    name: await token.read.name(),
    symbol: await token.read.symbol(),
    totalSupply: await token.read.totalSupply(),
  });

  const contract: ContractTypesMap["ONVestingMain"] = getContract({
    abi: abiVestingMain,
    address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    client,
  }) as any;

  const total = await contract.read.getVestingContractTotal();

  const information = await contract.read.getVestingDetailList([0n, total]);

  console.log(information);
})();
