import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ONVestingSub } from "../typechain-types";
import { VestingTermStruct } from "../typechain-types/contracts/ONInterface.sol/IONVestingSub";

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

    const start = timeTGE + ONE_MONTH * 3n;

    const end = start + ONE_MONTH * 12n;

    const vestingTerm = {
      beneficiary: beneficiary1,
      unlockedAtTGE: 1000n,
      milestoneDuration: ONE_MONTH,
      start,
      end,
      total: 1000000n,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(onVestingMain.connect(owner).addVestingTerm(vestingTerm))
      .to.emit(onVestingMain, "AddNewVestingContract")
      .withArgs(0, anyValue, beneficiary1.address);

    const getOnVestingSubByIndex = async (
      index: number
    ): Promise<ONVestingSub> => {
      return onVestingSubImpl.attach(
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
      timeTGE,
      getOnVestingSubByIndex,
    };
  }

  it("Should add a vesting term and emit event", async function () {
    const { owner, beneficiary2, onVestingMain, vestingTerm } =
      await loadFixture(fixture);
    // Cliff 3 months
    // Unlock at TGE 1,000
    // Total: 1,000,000
    const term: VestingTermStruct = {
      ...vestingTerm,
      beneficiary: beneficiary2,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(onVestingMain.connect(owner).addVestingTerm(term))
      .to.emit(onVestingMain, "AddNewVestingContract")
      .withArgs(1, anyValue, beneficiary2.address); // anyValue: address of new vesting contract

    // Should increment total count
    expect(await onVestingMain.getVestingContractTotal()).to.equal(2);

    expect(await onVestingMain.getVestingContractAddress(0)).to.properAddress;
  });

  it("Should able to claim token", async function () {
    const {
      owner,
      beneficiary1,
      onVestingMain,
      vestingTerm,
      timeTGE,
      token,
      getOnVestingSubByIndex,
    } = await loadFixture(fixture);

    const vestingContract = (await getOnVestingSubByIndex(0)).connect(
      beneficiary1
    );

    const releaseVesting = [];

    // Unlock at TGE should be correct
    await time.increaseTo(timeTGE);
    await vestingContract.claim();
    expect(await token.balanceOf(beneficiary1)).to.eq(
      vestingTerm.unlockedAtTGE
    );

    // The whole vesting timeline should be correct
    for (
      let currentTime = vestingTerm.start;
      currentTime <= vestingTerm.end;
      currentTime += vestingTerm.milestoneDuration
    ) {
      const beforeBalance = await token.balanceOf(beneficiary1);
      await time.increaseTo(currentTime);
      await vestingContract.claim();
      const milestone = BigInt(
        (currentTime - vestingTerm.start) / vestingTerm.milestoneDuration
      );
      const vestedToken =
        milestone * ((vestingTerm.total - vestingTerm.unlockedAtTGE) / 12n);
      expect(await token.balanceOf(beneficiary1)).to.eq(
        vestedToken + vestingTerm.unlockedAtTGE
      );
      releaseVesting.push({
        month: milestone,
        amount: (await token.balanceOf(beneficiary1)) - beforeBalance,
      });
    }
    expect(await token.balanceOf(beneficiary1)).to.eq(vestingTerm.total);
    console.table(releaseVesting);

    // Should not claim more than you have
    await time.increaseTo(vestingTerm.end + 3n * ONE_MONTH);
    expect(vestingContract.claim()).to.revertedWithCustomError(
      vestingContract,
      "InvalidVestingSchedule"
    );
  });
});
