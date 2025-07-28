import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { zeroAddress } from "viem";
import { ONVestingSub } from "../typechain-types";
import { on } from "events";
import { ZeroAddress } from "ethers";

const ONE_DAY = BigInt(24 * 60 * 60);
const ONE_MONTH = ONE_DAY * 30n;
const ONE_QUARTER = ONE_MONTH * 3n;

describe("ONVestingSub", function () {
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

    // Deploy a token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi", "ON");
    await token.waitForDeployment();

    // Deploy a ONVestingSub
    const ONVestingSub = await hre.ethers.getContractFactory("ONVestingSub");
    const onVestingSubImpl = await ONVestingSub.deploy();
    await onVestingSubImpl.waitForDeployment();

    // Deploy ONVestingMain
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

  it("Should able to transfer vesting contract", async function () {
    const { beneficiary1, beneficiary2, getOnVestingSubByIndex } =
      await loadFixture(fixture);

    const vestingSub = await getOnVestingSubByIndex(0n);

    expect(await vestingSub.getBeneficiary()).to.eq(beneficiary1.address);

    await expect(
      vestingSub.connect(beneficiary1).transferVestingContract(beneficiary2)
    )
      .to.emit(vestingSub, "TransferVestingContract")
      .withArgs(beneficiary1.address, beneficiary2.address);

    expect(await vestingSub.getBeneficiary()).to.eq(beneficiary2.address);
  });

  it("Should not able to init twice", async function () {
    const { beneficiary1, getOnVestingSubByIndex, vestingTerm, onVestingMain } =
      await loadFixture(fixture);

    const vestingSub = (await getOnVestingSubByIndex(0n)).connect(beneficiary1);

    await expect(
      vestingSub.init(onVestingMain, vestingTerm)
    ).to.revertedWithCustomError(vestingSub, "UnableToInitTwice");
  });

  it("Should not able to claim if you are not beneficiary", async function () {
    const { beneficiary2, getOnVestingSubByIndex, onVestingMain } =
      await loadFixture(fixture);

    const vestingSub = (await getOnVestingSubByIndex(0n)).connect(beneficiary2);
    await time.increaseTo(await onVestingMain.getTimeTGE());
    await expect(vestingSub.claim()).to.revertedWithCustomError(
      vestingSub,
      "InvalidBeneficiary"
    );
  });

  it("Should not able to init with zero address", async function () {
    const { ONVestingSub, vestingTerm, onVestingMain } = await loadFixture(
      fixture
    );

    const onVestingSub = await ONVestingSub.deploy();
    await onVestingSub.deploymentTransaction();
    await expect(
      onVestingSub.init(zeroAddress, vestingTerm)
    ).to.revertedWithCustomError(onVestingSub, "InvalidAddress");

    const newVestingTerm = {
      ...vestingTerm,
      beneficiary: zeroAddress,
    };

    await expect(
      onVestingSub.init(onVestingMain, newVestingTerm)
    ).to.revertedWithCustomError(onVestingSub, "InvalidAddress");
  });

  it("Should not able transfer vesting contract if you are not beneficiary", async function () {
    const { getOnVestingSubByIndex, anyOne, beneficiary1 } = await loadFixture(
      fixture
    );

    const vestingContract = await getOnVestingSubByIndex(0n);

    await expect(
      vestingContract.connect(anyOne).transferVestingContract(beneficiary1)
    ).to.revertedWithCustomError(vestingContract, "InvalidBeneficiary");
  });

  it("Should not able transfer vesting contract to zero-address", async function () {
    const { getOnVestingSubByIndex, beneficiary1 } = await loadFixture(
      fixture
    );

    const vestingContract = await getOnVestingSubByIndex(0n);

    await expect(
      vestingContract.connect(beneficiary1).transferVestingContract(zeroAddress)
    ).to.revertedWithCustomError(vestingContract, "InvalidBeneficiary");

    await expect(
      vestingContract.connect(beneficiary1).transferVestingContract(beneficiary1)
    ).to.revertedWithCustomError(vestingContract, "InvalidBeneficiary");
  });

  it("Should not able init with zero addresses", async function () {
    const { onVestingSubImpl, onVestingMain, vestingTerm, beneficiary2 } = await loadFixture(
      fixture
    );

    await expect(onVestingSubImpl.init(ZeroAddress, {
      ...vestingTerm,
      beneficiary: beneficiary2.address,
    })).to.revertedWithCustomError(onVestingSubImpl, "InvalidAddress");

    await expect(onVestingSubImpl.init(onVestingMain, {
      ...vestingTerm,
      beneficiary: ZeroAddress,
    })).to.revertedWithCustomError(onVestingSubImpl, "InvalidAddress");
  });

  it("Should able to init contract manualy", async function () {
    const { onVestingSubImpl, onVestingMain, vestingTerm, beneficiary2 } = await loadFixture(
      fixture
    );

    const term = {
      ...vestingTerm,
      beneficiary: beneficiary2.address,

    };
    await expect(onVestingMain.transfer(onVestingSubImpl, term.total)).to.emit(
      onVestingMain,
      "TransferToken");
    await onVestingSubImpl.init(onVestingMain, term)
  });
});
