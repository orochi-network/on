import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { ONVestingSub } from "../typechain-types";
import { VestingTermStruct } from "../typechain-types/contracts/ONInterface.sol/IONVestingSub";

const ONE_DAY = 24 * 60 * 60;
const ONE_MONTH = ONE_DAY * 30;
const ONE_QUARTER = ONE_MONTH * 3;

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
    const blockTimestamp = block.timestamp;
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

    const term: VestingTermStruct = {
      beneficiary: beneficiary1,
      unlockedAtTGE: 1000,
      milestoneDuration: ONE_MONTH,
      start: timeTGE + ONE_MONTH * 3,
      end: timeTGE + ONE_MONTH * 12,
      total: 1000000,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(onVestingMain.connect(owner).addVestingTerm(term))
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

  it("Should not able to add a vesting term if you are not owner", async function () {
    const { beneficiary2, onVestingMain, timeTGE, anyOne } = await loadFixture(
      fixture
    );
    // Cliff 3 months
    // Unlock at TGE 1,000
    // Total: 1,000,000
    const term: VestingTermStruct = {
      beneficiary: beneficiary2,
      unlockedAtTGE: 1000,
      milestoneDuration: ONE_MONTH,
      start: timeTGE + ONE_MONTH * 3,
      end: timeTGE + ONE_MONTH * 12,
      total: 1000000,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(
      onVestingMain.connect(anyOne).addVestingTerm(term)
    ).to.revertedWith("Ownable: caller is not the owner");
  });

  it("Should not able to claim token before TGE", async function () {
    const { beneficiary1, getOnVestingSubByIndex, onVestingSubImpl } =
      await loadFixture(fixture);

    const contract1 = await getOnVestingSubByIndex(0);
    expect(contract1.connect(beneficiary1).claim()).to.revertedWithCustomError(
      onVestingSubImpl,
      "TGENotStarted"
    );
  });
});
