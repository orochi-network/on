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

    const vestingTerm = {
      beneficiary: beneficiary1,
      unlockedAtTGE: 1000n,
      milestoneDuration: ONE_MONTH,
      cliff: ONE_MONTH * 3n,
      vestingDuration: 12n * ONE_MONTH,
      total: 1000000n,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(await onVestingMain.connect(owner).addVestingTerm(vestingTerm))
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
    await expect(await onVestingMain.connect(owner).addVestingTerm(term))
      .to.emit(onVestingMain, "AddNewVestingContract")
      .withArgs(1, anyValue, beneficiary2.address); // anyValue: address of new vesting contract

    // Should increment total count
    expect(await onVestingMain.getVestingContractTotal()).to.equal(2);

    expect(await onVestingMain.getVestingContractAddress(0)).to.properAddress;
  });

  it("Should able to get all information from ONVestingSub", async function () {
    const { vestingTerm, token, getOnVestingSubByIndex, onVestingMain } =
      await loadFixture(fixture);

    const vestingContract = await getOnVestingSubByIndex(0n);

    console.log(await vestingContract.getClaimableBalance());
    console.log(await vestingContract.getRemainingBalance());
  });

  it("Should able to claim all token if you are beneficiary and vested", async function () {
    const {
      beneficiary2,
      vestingTerm,
      token,
      getOnVestingSubByIndex,
      onVestingMain,
    } = await loadFixture(fixture);

    const newVesting = {
      ...vestingTerm,
      beneficiary: beneficiary2,
      unlockedAtTGE: vestingTerm.total,
    };

    await onVestingMain.addVestingTerm(newVesting);

    const vestingContract = (await getOnVestingSubByIndex(1n)).connect(
      beneficiary2
    );
    await time.increaseTo(await onVestingMain.getTimeTGE());
    await vestingContract.claim();
    expect(await token.balanceOf(beneficiary2)).to.eq(vestingTerm.total);

    expect(vestingContract.claim()).to.revertedWithCustomError(
      vestingContract,
      "InvalidVestingSchedule"
    );
  });

  it("Should able to claim token if you are beneficiary", async function () {
    const {
      beneficiary1,
      vestingTerm,
      token,
      getOnVestingSubByIndex,
      onVestingMain,
    } = await loadFixture(fixture);

    const vestingContract = (await getOnVestingSubByIndex(0n)).connect(
      beneficiary1
    );

    const releaseVesting = [];

    // Unlock at TGE should be correct
    await time.increaseTo(await onVestingMain.getTimeTGE());
    await vestingContract.claim();
    expect(await token.balanceOf(beneficiary1)).to.eq(
      vestingTerm.unlockedAtTGE
    );

    const timeStart = await vestingContract.getTimeStart();
    const timeEnd = await vestingContract.getTimeEnd();

    // The whole vesting timeline should be correct
    for (
      let currentTime = timeStart;
      currentTime <= timeEnd;
      currentTime += vestingTerm.milestoneDuration
    ) {
      const beforeBalance = await token.balanceOf(beneficiary1);
      await time.increaseTo(currentTime);
      await vestingContract.claim();
      const milestone = BigInt(
        (currentTime - timeStart) / vestingTerm.milestoneDuration
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
    await time.increaseTo(timeEnd + ONE_MONTH);
    expect(vestingContract.claim()).to.revertedWithCustomError(
      vestingContract,
      "InvalidVestingSchedule"
    );
  });

  it("Should to update all information before TGE", async function () {
    const { beneficiary2, onVestingMain } = await loadFixture(fixture);

    const [information1] = await onVestingMain.getVestingDetailList(0n, 1n);
    const newTimeTGE = (await onVestingMain.getTimeTGE()) + ONE_MONTH;
    await onVestingMain.setTimeTGE(newTimeTGE);

    const [information2] = await onVestingMain.getVestingDetailList(0n, 1n);

    expect(information1.start + ONE_MONTH).to.eq(information2.start);
    expect(information1.end + ONE_MONTH).to.eq(information2.end);
    expect(information1.end - information1.start).to.eq(
      information2.end - information2.start
    );

    expect(await onVestingMain.setImplementation(beneficiary2)).to.emit(
      onVestingMain,
      "SetImplementation"
    );

    expect(await onVestingMain.setTokenAddress(beneficiary2)).to.emit(
      onVestingMain,
      "SetTokenAddress"
    );

    expect(await onVestingMain.getTokenAddress()).to.eq(beneficiary2.address);
    expect(await onVestingMain.getImplementation()).to.eq(beneficiary2.address);
    expect(await onVestingMain.getTimeTGE()).to.eq(newTimeTGE);
  });
});
