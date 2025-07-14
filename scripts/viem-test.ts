import { createPublicClient, getContract, http } from "viem";
import { localhost } from "viem/chains";
import { ContractTypesMap } from "hardhat/types/artifacts";
import { abi } from "../artifacts/contracts/ONVestingMain.sol/ONVestingMain.json";

(async () => {
  const client = createPublicClient({
    chain: localhost,
    transport: http(),
  });

  const contract: ContractTypesMap["ONVestingMain"] = getContract({
    abi,
    address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    client,
  }) as any;

  const total = await contract.read.getVestingContractTotal();

  const information = await contract.read.getVestingDetailList([0n, total]);

  console.log(information);
})();
