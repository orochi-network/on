import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { parseEther } from "ethers";
import hre from "hardhat";
import { zeroAddress } from "viem";

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

    // Deploy a token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi", "ON");
    await token.waitForDeployment();

    // Deploy ONVestingSub implementation
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

    // Deploy ONAirdrop
    const ONAirdrop = await hre.ethers.getContractFactory("ONAirdrop");
    const onAirdrop = await ONAirdrop.connect(owner).deploy(onVestingMain);
    await onAirdrop.deploymentTransaction();

    await token.transferOwnership(onVestingMain);

    await onVestingMain.mint();

    await onVestingMain.transfer(onAirdrop, parseEther("20000000"));

    await onAirdrop.addRecipient([receiver1], [parseEther("1234")]);

    return {
      owner,
      receiver1,
      receiver2,
      anyOne,
      token,
      onVestingMain,
      onAirdrop,
      timeTGE,
    };
  }

  it("Should able to withdraw token after TGE", async function () {
    const { receiver1, onAirdrop, onVestingMain } = await loadFixture(fixture);

    time.increaseTo(await onVestingMain.getTimeTGE());

    expect(await onAirdrop.getAirdropBalance(receiver1)).to.eq(parseEther("1234"));

    await expect(onAirdrop.connect(receiver1).claim()).to.emit(
      onAirdrop,
      "AirdropClaimed"
    );

    await expect(
      onAirdrop.connect(receiver1).claim()
    ).to.revertedWithCustomError(onAirdrop, "AirdropTransferFailed");

    expect(await onAirdrop.getAirdropBalance(receiver1)).to.eq(0n);
  });

  it("Should able to add new airdrop if length mistmatch", async function () {
    const { receiver2, onAirdrop } = await loadFixture(fixture);
    await expect(
      onAirdrop.addRecipient(
        [receiver2],
        [parseEther("445"), parseEther("657")]
      )
    )
      .to.revertedWithCustomError(onAirdrop, "RecipientAmountLengthMismatch")
      .withArgs(1n, 2n);
  });

  it("Should not able to add new airdrop if TGE started", async function () {
    const { receiver2, onAirdrop, onVestingMain } = await loadFixture(fixture);

    time.increaseTo(await onVestingMain.getTimeTGE());

    await expect(onAirdrop.addRecipient([receiver2], [parseEther("445")]))
      .to.emit(onAirdrop, "AirdropRecipientAdded");
  });

  it("Should not able to claim before TGE started", async function () {
    const { receiver1, onAirdrop } = await loadFixture(fixture);

    await expect(
      onAirdrop.connect(receiver1).claim()
    ).to.revertedWithCustomError(onAirdrop, "TGENotStarted");
  });

  it("Should have TGE time correct", async function () {
    const { onVestingMain, timeTGE } = await loadFixture(fixture);

    expect(
      await onVestingMain.getTimeTGE()
    ).to.equal(timeTGE);
  });

  it("Should able to remove recipient", async function () {
    const { receiver1, onAirdrop } = await loadFixture(fixture);

    expect(await onAirdrop.getAirdropBalance(receiver1)).to.eq(parseEther("1234"));
    await expect(onAirdrop.removeRecipient([receiver1])).to.emit(
      onAirdrop,
      "AirdropRecipientRemoved"
    );
    expect(await onAirdrop.getAirdropBalance(receiver1)).to.eq(0n);
  });

  it("Should not able to add/remove recipient if you are not owner", async function () {
    const { anyOne, receiver1, receiver2, onAirdrop } = await loadFixture(fixture);


    await expect(onAirdrop.connect(anyOne).addRecipient([receiver2], [parseEther('1000')])).to.revertedWithCustomError(
      onAirdrop,
      "OwnableUnauthorizedAccount"
    );

    await expect(onAirdrop.connect(anyOne).removeRecipient([receiver1])).to.revertedWithCustomError(
      onAirdrop,
      "OwnableUnauthorizedAccount"
    );
  });

  it("Should ignore zero addresss and zero amount", async function () {
    const { owner, receiver1, receiver2, onAirdrop } = await loadFixture(fixture);


    await onAirdrop.connect(owner).addRecipient([zeroAddress, receiver2], [parseEther('1000'), 0n]);

    expect(await onAirdrop.getAirdropBalance(zeroAddress)).to.eq(0n);
    expect(await onAirdrop.getAirdropBalance(receiver2)).to.eq(0n);

    await onAirdrop.connect(owner).removeRecipient([zeroAddress, receiver1, receiver2]);
    expect(await onAirdrop.getAirdropBalance(receiver2)).to.eq(0n);
    expect(await onAirdrop.getAirdropBalance(receiver1)).to.eq(0n);
    expect(await onAirdrop.getAirdropBalance(zeroAddress)).to.eq(0n);
  });
});
