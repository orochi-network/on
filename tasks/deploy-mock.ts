import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { parseEther } from "ethers";
import { task } from "hardhat/config";
import { expect } from "chai";
import { VestingTermStruct } from "../typechain-types/contracts/ONVestingMain";
import { getEncryptWallet } from "../scripts/wallet";

const ONE_HOUR = 60n * 60n;
const CONFIRMATION = 2;

task("deploy-mock", "Deploy mock contracts").setAction(async (_args, hre) => {
  const beneficiary = "0x3FB52F41bd66ec0b59419F95f2612341262618ee";
  const [account1] = await hre.ethers.getSigners();

  const deployer = (await getEncryptWallet()).connect(hre.ethers.provider);

  if (hre.network.name === "local" || hre.network.name === "hardhat") {
    await account1.sendTransaction({
      to: deployer.address,
      value: parseEther("100"),
    });
  }

  // Deploy a token
  const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
  const token = await Token.connect(deployer).deploy("Orochi", "ON");
  await token.waitForDeployment();

  // Get block timestamp
  const block = await hre.ethers.provider.getBlock("latest");
  if (!block) {
    throw new Error("Invalid block timestamp");
  }
  const blockTimestamp = BigInt(block.timestamp);
  const timeTGE = blockTimestamp + 60n;

  // Deploy ONVestingSub implementation
  const ONVestingSub = await hre.ethers.getContractFactory("ONVestingSub");
  const onVestingSubImpl = await ONVestingSub.connect(deployer).deploy();
  await onVestingSubImpl.waitForDeployment();

  // Deploy ONVestingMain
  const MockVestingMain = await hre.ethers.getContractFactory(
    "MockVestingMain"
  );
  const mockVestingMain = await MockVestingMain.connect(deployer).deploy(
    token,
    timeTGE,
    onVestingSubImpl
  );

  // Deploy AirDrop
  const MockAirdrop = await hre.ethers.getContractFactory("MockAirdrop");
  const mockAirdrop = await MockAirdrop.connect(deployer).deploy(
    mockVestingMain
  );
  await mockAirdrop.waitForDeployment();

  await (await token.transferOwnership(mockVestingMain)).wait(CONFIRMATION);

  await (await mockVestingMain.mint()).wait(CONFIRMATION);

  const cliff = ONE_HOUR * 3n;

  const vestingDuration = ONE_HOUR * 12n;

  const vestingTerm: VestingTermStruct = {
    beneficiary,
    unlockedAtTGE: parseEther("1000"),
    milestoneDuration: ONE_HOUR,
    cliff,
    vestingDuration,
    total: parseEther("1000000"),
  };

  await (await mockVestingMain.addVestingTerm(vestingTerm)).wait(CONFIRMATION);

  // Transfer token to airdrop
  await (
    await mockVestingMain.transfer(mockAirdrop, parseEther("20000000"))
  ).wait(CONFIRMATION);

  await (
    await mockAirdrop.addRecipient([beneficiary], [parseEther("1000")])
  ).wait(CONFIRMATION);

  console.table([
    {
      contractName: "Deployer",
      address: deployer.address,
    },
    {
      contractName: "Beneficiary",
      address: beneficiary,
    },
    {
      contractName: "Orochi Network Airdrop",
      address: await mockAirdrop.getAddress(),
    },
    {
      contractName: "Orochi Network Token",
      address: await token.getAddress(),
    },
    {
      contractName: "Mock Vesting Main",
      address: await mockVestingMain.getAddress(),
    },
    {
      contractName: "Orochi Network Vesting Sub",
      address: await mockVestingMain.getVestingContractAddress(0),
    },
  ]);
});
