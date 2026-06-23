import {
  loadFixture,
  time,
  setCode,
  setStorageAt,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { AbiCoder, keccak256, toBeHex, zeroPadValue, ZeroAddress } from "ethers";
import hre from "hardhat";
import { ONVestingSub, OrochiNetworkToken } from "../typechain-types";

const ONE_DAY = BigInt(24 * 60 * 60);
const ONE_MONTH = ONE_DAY * 30n;

// The ON token address hardcoded inside ONCustomizedVesting.
const TOKEN_ADDR = "0x33f6BE84becfF45ea6aA2952d7eF890B44bFB59d";

describe("ONCustomizedVesting", function () {
  async function fixture() {
    const [owner, beneficiary1, beneficiary2, anyOne] =
      await hre.ethers.getSigners();

    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) {
      throw new Error("Invalid block timestamp");
    }
    const blockTimestamp = BigInt(block.timestamp);
    const timeTGE = blockTimestamp + ONE_MONTH;

    const ONCustomizedVesting = await hre.ethers.getContractFactory(
      "ONCustomizedVesting"
    );
    const onCustomizedVesting = await ONCustomizedVesting.deploy(timeTGE);
    await onCustomizedVesting.waitForDeployment();

    return {
      ONCustomizedVesting,
      onCustomizedVesting,
      owner,
      beneficiary1,
      beneficiary2,
      anyOne,
      blockTimestamp,
      timeTGE,
    };
  }

  // Install OrochiNetworkToken runtime bytecode at the hardcoded TOKEN address.
  async function deployTokenAtHardcodedAddress(): Promise<OrochiNetworkToken> {
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const tmp = await Token.deploy("Orochi", "ON");
    await tmp.waitForDeployment();
    const code = await hre.ethers.provider.getCode(tmp);
    await setCode(TOKEN_ADDR, code);
    return Token.attach(TOKEN_ADDR) as unknown as OrochiNetworkToken;
  }

  // Seed `balanceOf(account) = amount`. OZ ERC20 v5 keeps `_balances` in
  // storage slot 0, so the balance lives at keccak256(abi.encode(account, 0)).
  async function seedBalance(account: string, amount: bigint) {
    const slot = keccak256(
      AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [account, 0])
    );
    await setStorageAt(TOKEN_ADDR, slot, zeroPadValue(toBeHex(amount), 32));
  }

  it("Should expose the hardcoded ON token address", async function () {
    const { onCustomizedVesting } = await loadFixture(fixture);
    expect(await onCustomizedVesting.getTokenAddress()).to.eq(TOKEN_ADDR);
    expect(await onCustomizedVesting.TOKEN()).to.eq(TOKEN_ADDR);
  });

  it("Should report the TGE time and isTGE across the boundary", async function () {
    const { onCustomizedVesting, timeTGE } = await loadFixture(fixture);
    expect(await onCustomizedVesting.getTimeTGE()).to.eq(timeTGE);
    expect(await onCustomizedVesting.isTGE()).to.eq(false);

    await time.increaseTo(timeTGE);
    expect(await onCustomizedVesting.isTGE()).to.eq(true);
  });

  it("Should let the owner set the TGE time freely and block non-owners", async function () {
    const { onCustomizedVesting, owner, anyOne, timeTGE } = await loadFixture(
      fixture
    );

    const newTGE = timeTGE + ONE_MONTH;
    await expect(onCustomizedVesting.connect(owner).setTimeTGE(newTGE))
      .to.emit(onCustomizedVesting, "SetTimeTGE")
      .withArgs(newTGE);
    expect(await onCustomizedVesting.getTimeTGE()).to.eq(newTGE);

    await expect(
      onCustomizedVesting.connect(anyOne).setTimeTGE(timeTGE)
    ).to.revertedWithCustomError(
      onCustomizedVesting,
      "OwnableUnauthorizedAccount"
    );
  });

  it("Should seal the TGE time once ownership is renounced", async function () {
    const { onCustomizedVesting, owner, timeTGE } = await loadFixture(fixture);

    await onCustomizedVesting.connect(owner).renounceOwnership();
    expect(await onCustomizedVesting.owner()).to.eq(ZeroAddress);

    await expect(
      onCustomizedVesting.connect(owner).setTimeTGE(timeTGE + 1n)
    ).to.revertedWithCustomError(
      onCustomizedVesting,
      "OwnableUnauthorizedAccount"
    );
  });

  it("Should let a standalone ONVestingSub vest and claim using this minimal main", async function () {
    const { onCustomizedVesting, beneficiary1, timeTGE } = await loadFixture(
      fixture
    );

    // Put the ON token at its hardcoded address.
    const token = await deployTokenAtHardcodedAddress();

    // Deploy a standalone ONVestingSub and initialise it against the main.
    const ONVestingSub = await hre.ethers.getContractFactory("ONVestingSub");
    const sub = (await ONVestingSub.deploy()) as ONVestingSub;
    await sub.waitForDeployment();

    const term = {
      beneficiary: beneficiary1.address,
      unlockedAtTGE: 1000n,
      milestoneDuration: ONE_MONTH,
      cliff: ONE_MONTH * 3n,
      vestingDuration: 12n * ONE_MONTH,
      total: 1000000n,
    };
    await sub.init(onCustomizedVesting, term);

    // Fund the sub by transferring the token to it (direct-transfer model).
    await seedBalance(await sub.getAddress(), term.total);
    expect(await token.balanceOf(sub)).to.eq(term.total);
    expect(await sub.getRemainingBalance()).to.eq(term.total);

    const subB = sub.connect(beneficiary1);

    // Claim the unlocked-at-TGE amount.
    await time.increaseTo(timeTGE);
    await subB.claim();
    expect(await token.balanceOf(beneficiary1)).to.eq(term.unlockedAtTGE);

    // Vest through the full schedule.
    const start = await sub.getTimeStart();
    const end = await sub.getTimeEnd();
    for (let t = start + ONE_MONTH; t <= end; t += term.milestoneDuration) {
      await time.increaseTo(t);
      await subB.claim();
      const milestone = BigInt((t - start) / term.milestoneDuration);
      const vested = milestone * ((term.total - term.unlockedAtTGE) / 12n);
      expect(await token.balanceOf(beneficiary1)).to.eq(
        vested + term.unlockedAtTGE
      );
    }

    // Fully vested.
    expect(await token.balanceOf(beneficiary1)).to.eq(term.total);
  });
});
