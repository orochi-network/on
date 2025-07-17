import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ONVestingSub } from "../typechain-types";
import { VestingTermStruct } from "../typechain-types/contracts/ONInterface.sol/IONVestingSub";
import { ZeroAddress } from "ethers";

const ONE_DAY = BigInt(24 * 60 * 60);
const ONE_MONTH = ONE_DAY * 30n;
const ONE_QUARTER = ONE_MONTH * 3n;

describe("ONVestingMain", function () {
  async function fixture() {
    // Mock VestingTerm struct
    const [owner, beneficiary1, beneficiary2, anyOne] =
      await hre.ethers.getSigners();

    // Get block timestamp
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) {
      throw new Error("Invalid block timestamp");
    }
    const blockTimestamp = BigInt(block.timestamp);
    const timeTGE = blockTimestamp + ONE_MONTH;

    // Deploy a mock token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi", "ON");
    await token.waitForDeployment();

    // Deploy a mock ONVestingSub implementation with a mock "init" function
    const ONVestingSub = await hre.ethers.getContractFactory("ONVestingSub");
    const onVestingSubImpl = await ONVestingSub.deploy();
    await onVestingSubImpl.waitForDeployment();

    // Deploy a minimal ONVestingMain with suitable constructor args
    const ONVestingMain = await hre.ethers.getContractFactory("ONVestingMain");
    const onVestingMain = await ONVestingMain.deploy(
      token,
      timeTGE,
      onVestingSubImpl
    );
    await onVestingMain.waitForDeployment();

    await token.transferOwnership(onVestingMain);

    await onVestingMain.mint();

    const vestingTerm = {
      beneficiary: beneficiary1,
      unlockedAtTGE: 1000n,
      milestoneDuration: ONE_MONTH,
      cliff: ONE_MONTH * 3n,
      vestingDuration: 12n * ONE_MONTH,
      total: 1000000n,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(onVestingMain.connect(owner).addVestingTerm(vestingTerm))
      .to.emit(onVestingMain, "AddNewVestingContract")
      .withArgs(0, anyValue, beneficiary1.address);

    const getOnVestingSubByIndex = async (
      index: bigint
    ): Promise<ONVestingSub> => {
      return ONVestingSub.attach(
        await onVestingMain.getVestingContractAddress(index)
      ) as ONVestingSub;
    };

    return {
      vestingTerm,
      owner,
      beneficiary1,
      beneficiary2,
      anyOne,
      token,
      ONVestingSub,
      onVestingSubImpl,
      onVestingMain,
      blockTimestamp,
      getOnVestingSubByIndex,
    };
  }

  it("Should not able to add a vesting term if you are not owner", async function () {
    const { beneficiary2, onVestingMain, anyOne, vestingTerm } =
      await loadFixture(fixture);
    // Cliff 3 months
    // Unlock at TGE 1,000
    // Total: 1,000,000
    const term: VestingTermStruct = {
      ...vestingTerm,
      beneficiary: beneficiary2,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(
      onVestingMain.connect(anyOne).addVestingTerm(term)
    ).to.revertedWith("Ownable: caller is not the owner");
  });

  it("Should not able to claim token before TGE", async function () {
    const { beneficiary1, getOnVestingSubByIndex, onVestingSubImpl } =
      await loadFixture(fixture);

    const contract1 = await getOnVestingSubByIndex(0n);
    expect(contract1.connect(beneficiary1).claim()).to.revertedWithCustomError(
      onVestingSubImpl,
      "TGENotStarted"
    );
  });

  it("Should not able to claim token before TGE", async function () {
    const { beneficiary1, getOnVestingSubByIndex, onVestingSubImpl } =
      await loadFixture(fixture);

    const contract1 = await getOnVestingSubByIndex(0n);
    expect(contract1.connect(beneficiary1).claim()).to.revertedWithCustomError(
      onVestingSubImpl,
      "TGENotStarted"
    );
  });

  it("Should not able to change TGE time after TGE", async function () {
    const { onVestingMain } = await loadFixture(fixture);

    const timeTGE = await onVestingMain.getTimeTGE();

    time.increaseTo(timeTGE);
    expect(
      onVestingMain.setTimeTGE(timeTGE + ONE_DAY)
    ).to.revertedWithCustomError(onVestingMain, "TGEAlreadyStarted");
  });

  it("Should not able to deploy vesting main with zero address", async function () {
    const { token, onVestingSubImpl, blockTimestamp, onVestingMain } =
      await loadFixture(fixture);
    // Deploy a minimal ONVestingMain with suitable constructor args
    const ONVestingMain = await hre.ethers.getContractFactory("ONVestingMain");

    expect(
      ONVestingMain.deploy(
        ZeroAddress,
        blockTimestamp + ONE_MONTH,
        onVestingSubImpl
      )
    ).to.revertedWithCustomError(onVestingMain, "InvalidAddress");

    expect(
      ONVestingMain.deploy(token, blockTimestamp + ONE_MONTH, ZeroAddress)
    ).to.revertedWithCustomError(onVestingMain, "InvalidAddress");
  });

  it("Should not able to add new vesting term after TGE", async function () {
    const { onVestingMain, vestingTerm } = await loadFixture(fixture);

    await time.increaseTo(await onVestingMain.getTimeTGE());

    expect(
      onVestingMain.addVestingTerm(vestingTerm)
    ).to.revertedWithCustomError(onVestingMain, "TGEAlreadyStarted");
  });

  it("Should not able to add invalid vesting", async function () {
    const { onVestingMain, vestingTerm } = await loadFixture(fixture);

    const newTerm = {
      ...vestingTerm,
      milestoneDuration: 0n,
    };

    expect(onVestingMain.addVestingTerm(newTerm)).to.revertedWithCustomError(
      onVestingMain,
      "UnableToAddNewVestingContract"
    );
  });

  it("Should not able to add vesting term with invalid token", async function () {
    const { onVestingMain, vestingTerm } = await loadFixture(fixture);

    // Deploy a invalid token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi", "ON");
    await token.waitForDeployment();

    await onVestingMain.setTokenAddress(token);

    expect(onVestingMain.addVestingTerm(vestingTerm)).to.revertedWith(
      "ERC20: transfer amount exceeds balance"
    );
  });
});
