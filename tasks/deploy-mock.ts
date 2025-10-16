import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { parseEther } from "ethers";
import { task } from "hardhat/config";
import { expect } from "chai";
import { VestingTermStruct } from "../typechain-types/contracts/ONVestingMain";
import { getKmsWallet } from "../scripts/wallet";

const ONE_HOUR = 60n * 60n;
const CONFIRMATION = 2;

task("deploy-mock", "Deploy mock contracts").setAction(async (_args, hre) => {
  const beneficiary = "0x3FB52F41bd66ec0b59419F95f2612341262618ee";
  const [account1, operator] = await hre.ethers.getSigners();

  const deployer = (await getKmsWallet()).connect(hre.ethers.provider);

  if (hre.network.name === "local" || hre.network.name === "hardhat") {
    // Mine block on hardhat network
    setInterval(async () => {
      await hre.network.provider.send("evm_mine");
    }, 500);
    await account1.sendTransaction({
      to: await deployer.getAddress(),
      value: parseEther("100"),
    });
  }

  // Deploy on token
  const ONToken = await hre.ethers.getContractFactory("OrochiNetworkToken");
  const onToken = await ONToken.connect(deployer).deploy(
    "Orochi Network Token",
    "ON"
  );
  await onToken.waitForDeployment();

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
    onToken,
    timeTGE,
    onVestingSubImpl
  );

  // Deploy AirDrop
  const MockAirdrop = await hre.ethers.getContractFactory("MockAirdrop");
  const mockAirdrop = await MockAirdrop.connect(deployer).deploy(
    mockVestingMain,
    [operator]
  );
  await mockAirdrop.waitForDeployment();

  await (await onToken.transferOwnership(mockVestingMain)).wait(CONFIRMATION);

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

  console.table([
    {
      contractName: "Deployer",
      address: await deployer.getAddress(),
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
      address: await onToken.getAddress(),
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
