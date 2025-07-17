import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { zeroAddress } from "viem";
import { ONVestingSub } from "../typechain-types";
import { parseEther } from "ethers";

const ONE_DAY = BigInt(24 * 60 * 60);
const ONE_MONTH = ONE_DAY * 30n;
const ONE_QUARTER = ONE_MONTH * 3n;

describe("ONAirdrop", function () {
  async function fixture() {
    // Mock VestingTerm struct
    const [owner, receiver1, receiver2, anyOne] = await hre.ethers.getSigners();

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

    // Deploy ONAirdrop
    const ONAirdrop = await hre.ethers.getContractFactory("ONAirdrop");
    const onAirdrop = await ONAirdrop.connect(owner).deploy(onVestingMain);
    await onAirdrop.deploymentTransaction();

    await token.transferOwnership(onVestingMain);

    await onVestingMain.mint();

    await onVestingMain.transfer(onAirdrop, parseEther("20000000"));

    await onAirdrop.addUserToAirdrop([receiver1], [parseEther("1234")]);

    return {
      owner,
      receiver1,
      receiver2,
      anyOne,
      token,
      onVestingMain,
      onAirdrop,
    };
  }

  it("Should able to withdraw token after TGE", async function () {
    const { receiver1, onAirdrop, onVestingMain } = await loadFixture(fixture);

    time.increaseTo(await onVestingMain.getTimeTGE());

    expect(await onAirdrop.balanceAirdrop(receiver1)).to.eq(parseEther("1234"));

    await expect(onAirdrop.connect(receiver1).claimAirdrop()).to.emit(
      onAirdrop,
      "AirdropClaim"
    );

    await expect(
      onAirdrop.connect(receiver1).claimAirdrop()
    ).to.revertedWithCustomError(onAirdrop, "UnableToAirdropToken");
  });

  it("Should able to add new airdrop if length mistmatch", async function () {
    const { receiver2, onAirdrop } = await loadFixture(fixture);
    await expect(
      onAirdrop.addUserToAirdrop(
        [receiver2],
        [parseEther("445"), parseEther("657")]
      )
    )
      .to.revertedWithCustomError(onAirdrop, "BeneficiaryAmountMismatch")
      .withArgs(1n, 2n);
  });

  it("Should not able to add new airdrop if TGE started", async function () {
    const { receiver2, onAirdrop, onVestingMain } = await loadFixture(fixture);

    time.increaseTo(await onVestingMain.getTimeTGE());

    expect(onAirdrop.addUserToAirdrop([receiver2], [parseEther("445")]))
      .to.revertedWithCustomError(onAirdrop, "TGEAlreadyStarted")
      .withArgs(1n, 2n);
  });

  it("Should not able to claim before TGE started", async function () {
    const { receiver1, onAirdrop, onVestingMain } = await loadFixture(fixture);

    await expect(
      onAirdrop.connect(receiver1).claimAirdrop()
    ).to.revertedWithCustomError(onAirdrop, "TGENotStarted");
  });
});
