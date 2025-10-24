import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DEPLOYED_ADDRESS } from "./deployed";
import { ContractRunner } from "ethers";
import { BNBOrochiNetworkToken, ONVestingMain } from "../typechain-types";

export async function getBNBONToken(
  hre: HardhatRuntimeEnvironment,
  actor: ContractRunner
): Promise<BNBOrochiNetworkToken> {
  if (hre.network.name !== "bnb") {
    throw new Error("Wrong network, BNB chain is expected");
  }
  // Get token instance
  const ONToken = await hre.ethers.getContractFactory("BNBOrochiNetworkToken");
  return ONToken.connect(actor).attach(
    DEPLOYED_ADDRESS.BNBOnToken.address
  ) as BNBOrochiNetworkToken;
}

export async function getONVestingMain(
  hre: HardhatRuntimeEnvironment,
  actor: ContractRunner
): Promise<ONVestingMain> {
  if (hre.network.name !== "bnb") {
    throw new Error("Wrong network, BNB chain is expected");
  }
  // Get token instance
  const ONToken = await hre.ethers.getContractFactory("ONVestingMain");
  return ONToken.connect(actor).attach(
    DEPLOYED_ADDRESS.onVestingMain.address
  ) as ONVestingMain;
}
