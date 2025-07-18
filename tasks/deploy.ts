import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { parseEther } from "ethers";
import { task } from "hardhat/config";
import { expect } from "chai";

const ONE_MIN = 60n;

task("deploy", "Deploy the OrochiNetworkToken contract").setAction(
  async (_args, hre) => {
    const [deployer, beneficiary] = await hre.ethers.getSigners();
    // Deploy a mock token
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

    // Deploy a mock ONVestingSub implementation with a mock "init" function
    const ONVestingSub = await hre.ethers.getContractFactory("ONVestingSub");
    const onVestingSubImpl = await ONVestingSub.connect(deployer).deploy();
    await onVestingSubImpl.waitForDeployment();

    // Deploy a minimal ONVestingMain with suitable constructor args
    const ONVestingMain = await hre.ethers.getContractFactory("ONVestingMain");
    const onVestingMain = await ONVestingMain.connect(deployer).deploy(
      token,
      timeTGE,
      onVestingSubImpl
    );

    await token.transferOwnership(onVestingMain);

    await onVestingMain.mint();

    const start = timeTGE + ONE_MIN * 3n;

    const end = start + ONE_MIN * 12n;

    const vestingTerm = {
      beneficiary: beneficiary,
      unlockedAtTGE: parseEther("1000"),
      milestoneDuration: ONE_MIN,
      start,
      end,
      total: parseEther("1000000"),
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(onVestingMain.connect(deployer).addVestingTerm(vestingTerm))
      .to.emit(onVestingMain, "AddNewVestingContract")
      .withArgs(0, anyValue, beneficiary.address);

    console.table([
      {
        contractName: "Deployer",
        address: deployer.address,
      },
      {
        contractName: "Beneficiary",
        address: beneficiary.address,
      },
      {
        contractName: "Orochi Network Token",
        address: await token.getAddress(),
      },
      {
        contractName: "Orochi Network Vesting Main",
        address: await onVestingMain.getAddress(),
      },
      {
        contractName: "Orochi Network Vesting Sub",
        address: await onVestingMain.getVestingContractAddress(0),
      },
    ]);
  }
);
