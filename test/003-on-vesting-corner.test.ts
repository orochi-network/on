import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { parseEther, ZeroAddress } from "ethers";
import hre from "hardhat";
import { ONVestingSub } from "../typechain-types";
import { VestingTermStruct } from "../typechain-types/contracts/ONVestingSub";

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

    // Deploy a token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi", "ON");
    await token.waitForDeployment();

    // Deploy a ONVestingSub implementation
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
    ).to.be.revertedWithCustomError(
      onVestingMain, 'OwnableUnauthorizedAccount'
    );

  });

  it("Should not able to add an invalid vesting term", async function () {
    const {
      beneficiary2,
      onVestingMain,
      owner,
      vestingTerm,
      onVestingSubImpl,
    } = await loadFixture(fixture);

    const invalidTerm: VestingTermStruct = {
      ...vestingTerm,
      beneficiary: beneficiary2,
      vestingDuration: 10n,
    };

    // out: event AddNewVestingContract(index, addr, beneficiary)
    await expect(
      onVestingMain.connect(owner).addVestingTerm(invalidTerm)
    ).to.revertedWithCustomError(onVestingSubImpl, "InvalidVestingTerm");
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
    await expect(
      contract1.connect(beneficiary1).claim()
    ).to.revertedWithCustomError(onVestingSubImpl, "TGENotStarted");
  });

  it("Should not able to change TGE time after TGE", async function () {
    const { onVestingMain } = await loadFixture(fixture);

    const timeTGE = await onVestingMain.getTimeTGE();

    time.increaseTo(timeTGE);
    await expect(
      onVestingMain.setTimeTGE(timeTGE + ONE_DAY)
    ).to.revertedWithCustomError(onVestingMain, "TGEAlreadyStarted");
  });

  it("Should not able to deploy vesting main with zero address", async function () {
    const { token, onVestingSubImpl, blockTimestamp, onVestingMain } =
      await loadFixture(fixture);
    // Deploy a minimal ONVestingMain with suitable constructor args
    const ONVestingMain = await hre.ethers.getContractFactory("ONVestingMain");

    await expect(
      ONVestingMain.deploy(
        ZeroAddress,
        blockTimestamp + ONE_MONTH,
        onVestingSubImpl
      )
    ).to.revertedWithCustomError(onVestingMain, "InvalidAddress");

    await expect(
      ONVestingMain.deploy(token, blockTimestamp + ONE_MONTH, ZeroAddress)
    ).to.revertedWithCustomError(onVestingMain, "InvalidAddress");
  });

  it("Should not able to add new vesting term after TGE", async function () {
    const { onVestingMain, vestingTerm } = await loadFixture(fixture);

    await time.increaseTo(await onVestingMain.getTimeTGE());

    await expect(
      onVestingMain.addVestingTerm(vestingTerm)
    ).to.revertedWithCustomError(onVestingMain, "TGEAlreadyStarted");
  });

  it("Should not able to add invalid token", async function () {
    const {
      token,
      beneficiary1,
      onVestingMain,
      vestingTerm,
      getOnVestingSubByIndex,
    } = await loadFixture(fixture);

    const MockTokenNoTransfer = await hre.ethers.getContractFactory(
      "MockTokenNoTransfer"
    );
    const mockToken = await MockTokenNoTransfer.deploy(token);
    await mockToken.deploymentTransaction();

    await onVestingMain.setTokenAddress(mockToken);

    await expect(
      onVestingMain.addVestingTerm(vestingTerm)
    ).to.revertedWithCustomError(
      onVestingMain,
      "UnableToAddNewVestingContract"
    );

    const vestingContract = await getOnVestingSubByIndex(0n);

    await time.increaseTo((await vestingContract.getTimeStart()) + ONE_MONTH);

    await expect(
      vestingContract.connect(beneficiary1).claim()
    ).to.revertedWithCustomError(vestingContract, "UnableToRelease");
  });

  it("Should not able to add wrong balance token", async function () {
    const { beneficiary1, onVestingMain, getOnVestingSubByIndex } =
      await loadFixture(fixture);

    const MockTokenWrongBalance = await hre.ethers.getContractFactory(
      "MockTokenWrongBalance"
    );
    const mockToken = await MockTokenWrongBalance.deploy();
    await mockToken.deploymentTransaction();

    await onVestingMain.setTokenAddress(mockToken);

    const vestingContract = await getOnVestingSubByIndex(0n);

    await time.increaseTo((await vestingContract.getTimeStart()) + ONE_MONTH);

    await expect(
      vestingContract.connect(beneficiary1).claim()
    ).to.revertedWithCustomError(vestingContract, "InsufficientBalance");
  });

  it("Should not able to add vesting term with invalid token", async function () {
    const { onVestingMain, vestingTerm } = await loadFixture(fixture);

    // Deploy a invalid token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi", "ON");
    await token.waitForDeployment();

    await onVestingMain.setTokenAddress(token);

    await expect(onVestingMain.addVestingTerm(vestingTerm)).to.revertedWithCustomError(
      token,
      "ERC20InsufficientBalance"
    );
  });

  it("Should not able to set TGE time in the past", async function () {
    const { onVestingMain, blockTimestamp } = await loadFixture(fixture);

    await expect(
      onVestingMain.setTimeTGE(blockTimestamp - 10n)
    ).to.revertedWithCustomError(onVestingMain, "TGETimeMustBeInTheFuture");
  });

  it("Should not able to transfer invalid token", async function () {
    const {
      token,
      beneficiary1,
      onVestingMain,
    } = await loadFixture(fixture);

    const MockTokenNoTransfer = await hre.ethers.getContractFactory(
      "MockTokenNoTransfer"
    );
    const mockToken = await MockTokenNoTransfer.deploy(token);
    await mockToken.deploymentTransaction();

    await onVestingMain.setTokenAddress(mockToken);

    await expect(onVestingMain.transfer(beneficiary1, parseEther("100"))).to.revertedWithCustomError(onVestingMain, 'UnableToTransfer');
  });

  it("Should not able call if not owner", async function () {
    const {
      beneficiary1,
      onVestingMain,
      getOnVestingSubByIndex,
      anyOne,
      blockTimestamp,
    } = await loadFixture(fixture);

    const vestingMainFakeOwner = await onVestingMain.connect(anyOne);

    await expect(vestingMainFakeOwner.mint()).to.revertedWithCustomError(vestingMainFakeOwner,
      'OwnableUnauthorizedAccount'
    );

    await expect(
      vestingMainFakeOwner.transfer(beneficiary1, parseEther("100"))
    ).to.revertedWithCustomError(vestingMainFakeOwner,
      'OwnableUnauthorizedAccount'
    );

    await expect(
      vestingMainFakeOwner.setTokenAddress(beneficiary1)
    ).to.revertedWithCustomError(vestingMainFakeOwner,
      'OwnableUnauthorizedAccount'
    );

    await expect(
      vestingMainFakeOwner.setImplementation(beneficiary1)
    ).to.revertedWithCustomError(vestingMainFakeOwner,
      'OwnableUnauthorizedAccount'
    );

    await expect(
      vestingMainFakeOwner.setTimeTGE(blockTimestamp)
    ).to.revertedWithCustomError(vestingMainFakeOwner,
      'OwnableUnauthorizedAccount'
    );

    await time.increaseTo(await onVestingMain.getTimeTGE());

    await expect(
      onVestingMain.setTokenAddress(beneficiary1)
    ).to.revertedWithCustomError(onVestingMain, "TGEAlreadyStarted");

    await expect(
      onVestingMain.setImplementation(beneficiary1)
    ).to.to.revertedWithCustomError(onVestingMain, "TGEAlreadyStarted");

    await expect(
      onVestingMain.setTimeTGE(blockTimestamp)
    ).to.to.revertedWithCustomError(onVestingMain, "TGEAlreadyStarted");

    await expect(onVestingMain.mint()).to.to.revertedWithCustomError(
      onVestingMain,
      "TGEAlreadyStarted"
    );
  });

  it("Should not able to call emergency with invalid token", async function () {
    const {
      token,
      beneficiary1,
      onVestingMain,
      getOnVestingSubByIndex,
    } = await loadFixture(fixture);

    const MockTokenNoTransfer = await hre.ethers.getContractFactory(
      "MockTokenNoTransfer"
    );
    const mockToken = await MockTokenNoTransfer.deploy(token);
    await mockToken.deploymentTransaction();

    await onVestingMain.setTokenAddress(mockToken);

    const vestingContract = await getOnVestingSubByIndex(0n);

    await time.increaseTo((await vestingContract.getTimeEnd()) + ONE_QUARTER);

    await expect(
      vestingContract.connect(beneficiary1).emergency()
    ).to.revertedWithCustomError(vestingContract, "UnableToCallEmergency");
  });

  it("Should not able to claim token before TGE", async function () {
    const { beneficiary1, onVestingMain, getOnVestingSubByIndex, onVestingSubImpl, vestingTerm } =
      await loadFixture(fixture);

    const term = {
      ...vestingTerm,
      unlockedAtTGE: 0n,
    }

    await onVestingMain.addVestingTerm(term);

    const contract1 = await getOnVestingSubByIndex(1n);
    expect(await contract1.getClaimableBalance()).to.eq(
      0n
    );
  });
});
