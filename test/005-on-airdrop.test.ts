import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { getBytes, hashMessage, parseEther, verifyMessage } from "ethers";
import hre from "hardhat";
import { token } from "../typechain-types/@openzeppelin/contracts";

const ONE_DAY = BigInt(24 * 60 * 60);
const ONE_MONTH = ONE_DAY * 30n;
const ONE_QUARTER = ONE_MONTH * 3n;

describe("ONAirdrop", function () {
  async function fixture() {
    // Mock VestingTerm struct
    const [owner, receiver1, receiver2, anyOne, operator] =
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
    const onAirdrop = await ONAirdrop.connect(owner).deploy(onVestingMain, [
      operator,
    ]);
    await onAirdrop.deploymentTransaction();

    await token.transferOwnership(onVestingMain);

    await onVestingMain.mint();

    await onVestingMain.transfer(onAirdrop, parseEther("20000000"));

    return {
      owner,
      receiver1,
      receiver2,
      anyOne,
      token,
      onVestingMain,
      onAirdrop,
      operator,
      timeTGE,
    };
  }

  it("Airdrop should be deploy correct", async function () {
    const { onAirdrop, token } = await loadFixture(fixture);

    expect(await onAirdrop.getToken()).to.eq(await token.getAddress());
  });

  it("Should able to withdraw token after TGE", async function () {
    const { receiver1, onAirdrop, onVestingMain, operator, token } =
      await loadFixture(fixture);

    // Increase time to TGE time
    await time.increaseTo(await onVestingMain.getTimeTGE());

    // Request to claim 1234 token
    const requestClaim = await onAirdrop.getEncodeData(
      receiver1,
      parseEther("1234")
    );

    // Sign the claim proof
    const ecdsaProof = await operator.signMessage(getBytes(requestClaim));

    expect(
      verifyMessage(getBytes(requestClaim), ecdsaProof),
      "Invalid ECDSA signer"
    ).to.eq(operator.address);

    console.log("Operator address:", operator.address);

    // User claim token
    await expect(
      onAirdrop.connect(receiver1).claim(ecdsaProof, parseEther("1234"))
    ).to.emit(onAirdrop, "AirdropClaimed");

    expect(await token.balanceOf(receiver1)).to.eq(parseEther("1234"));

    expect(await onAirdrop.getRedeemed(receiver1)).to.eq(parseEther("1234"));

    expect(await onAirdrop.getNonce(receiver1)).to.eq(1n);
  });

  it("Owner should able to add/remove operator", async function () {
    const { onAirdrop, anyOne } = await loadFixture(fixture);

    await onAirdrop.addOperator([anyOne]);

    expect(await onAirdrop.isOperator(anyOne)).to.eq(true);

    await onAirdrop.removeOperator([anyOne]);

    expect(await onAirdrop.isOperator(anyOne)).to.eq(false);
  });

  it("Owner should able to add/remove operator", async function () {
    const { onAirdrop, anyOne } = await loadFixture(fixture);

    await onAirdrop.addOperator([anyOne]);

    expect(await onAirdrop.isOperator(anyOne)).to.eq(true);

    await onAirdrop.removeOperator([anyOne]);

    expect(await onAirdrop.isOperator(anyOne)).to.eq(false);
  });

  it("Should not able to claim pre TGE", async function () {
    const { receiver1, onAirdrop, operator } = await loadFixture(fixture);

    // Request to claim 1234 token
    const requestClaim = await onAirdrop.getEncodeData(
      receiver1,
      parseEther("1234")
    );

    // Sign the claim proof
    const ecdsaProof = await operator.signMessage(getBytes(requestClaim));

    // User claim token
    await expect(
      onAirdrop.connect(receiver1).claim(ecdsaProof, parseEther("1234"))
    ).to.revertedWithCustomError(onAirdrop, "TGENotStarted");
  });

  it("Should not able to claim with wrong opearator", async function () {
    const { receiver1, onAirdrop, onVestingMain, anyOne } = await loadFixture(
      fixture
    );

    // Increase time to TGE time
    await time.increaseTo(await onVestingMain.getTimeTGE());

    // Request to claim 1234 token
    const requestClaim = await onAirdrop.getEncodeData(
      receiver1,
      parseEther("1234")
    );

    // Sign the claim proof
    const ecdsaProof = await anyOne.signMessage(getBytes(requestClaim));

    // User claim token
    await expect(
      onAirdrop.connect(receiver1).claim(ecdsaProof, parseEther("1234"))
    ).to.revertedWithCustomError(onAirdrop, "InvalidProofSigner");
  });

  it("Should not able to claim a wrong amount", async function () {
    const { receiver1, onAirdrop, onVestingMain, operator } = await loadFixture(
      fixture
    );

    // Increase time to TGE time
    await time.increaseTo(await onVestingMain.getTimeTGE());

    // Request to claim 1234 token
    const requestClaim = await onAirdrop.getEncodeData(
      receiver1,
      parseEther("1234")
    );

    // Sign the claim proof
    const ecdsaProof = await operator.signMessage(getBytes(requestClaim));

    // User claim token
    await expect(
      onAirdrop.connect(receiver1).claim(ecdsaProof, parseEther("2234"))
    ).to.revertedWithCustomError(onAirdrop, "InvalidProofSigner");
  });

  it("Should not able to claim a wrong nonce", async function () {
    const { receiver1, onAirdrop, onVestingMain, operator, token } =
      await loadFixture(fixture);

    // Increase time to TGE time
    await time.increaseTo(await onVestingMain.getTimeTGE());

    // Request to claim 1234 token
    const requestClaim = await onAirdrop.getEncodeData(
      receiver1,
      parseEther("1234")
    );

    // Sign the claim proof
    const ecdsaProof = await operator.signMessage(getBytes(requestClaim));

    // User claim token
    await expect(
      onAirdrop.connect(receiver1).claim(ecdsaProof, parseEther("1234"))
    ).to.emit(onAirdrop, "AirdropClaimed");

    // User try to double claim
    await expect(
      onAirdrop.connect(receiver1).claim(ecdsaProof, parseEther("1234"))
    ).to.revertedWithCustomError(onAirdrop, "InvalidProofSigner");

    // Should not claim twice
    expect(await token.balanceOf(receiver1)).to.eq(parseEther("1234"));
  });

  it("Should not able to claim 0", async function () {
    const { receiver1, onAirdrop, onVestingMain, operator } = await loadFixture(
      fixture
    );

    // Increase time to TGE time
    await time.increaseTo(await onVestingMain.getTimeTGE());

    // Request to claim 1234 token
    const requestClaim = await onAirdrop.getEncodeData(
      receiver1,
      parseEther("0")
    );

    // Sign the claim proof
    const ecdsaProof = await operator.signMessage(getBytes(requestClaim));

    await expect(
      onAirdrop.connect(receiver1).claim(ecdsaProof, parseEther("0"))
    ).to.revertedWithCustomError(onAirdrop, "AirdropTransferFailed");
  });

  it("Should not able to add/remove operator if you are not owner", async function () {
    const { owner, onAirdrop, anyOne, receiver1, operator } = await loadFixture(
      fixture
    );

    await expect(
      onAirdrop.connect(receiver1).addOperator([anyOne])
    ).to.revertedWithCustomError(onAirdrop, "OwnableUnauthorizedAccount");

    expect(await onAirdrop.isOperator(receiver1)).to.eq(false);

    await expect(
      onAirdrop.connect(receiver1).removeOperator([operator])
    ).to.revertedWithCustomError(onAirdrop, "OwnableUnauthorizedAccount");

    expect(await onAirdrop.isOperator(operator)).to.eq(true);
  });
});
