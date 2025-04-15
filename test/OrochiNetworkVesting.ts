import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

describe("OrochiNetworkVesting", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployVestingFixture() {
    const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60;
    const ONE_HOUR = 60 * 60;
    const ONE_QUATER_IN_SECS = 3 * 30 * 24 * 60 * 60;
    const UNIT = 10n ** 18n;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const OrochiNetworkToken = await hre.ethers.getContractFactory(
      "OrochiNetworkToken"
    );
    const OrochiNetworkVesting = await hre.ethers.getContractFactory(
      "OrochiNetworkVesting"
    );

    const token = await OrochiNetworkToken.deploy("Orochi Network Token", "ON");
    const vesting = await OrochiNetworkVesting.deploy(await token.getAddress());
    await token.transferOwnership(await vesting.getAddress());

    const start = (await time.latest()) + ONE_HOUR;
    const end = start + ONE_MONTH_IN_SECS * 18;

    console.log({
      beneficiary: otherAccount.address,
      start,
      end,
      duration: ONE_MONTH_IN_SECS,
      unlocked: UNIT * 10n,
      total: UNIT * 1000n,
      milestone: (end - start) / ONE_MONTH_IN_SECS,
    });

    await vesting.addVestingTerm({
      beneficiary: otherAccount.address,
      start,
      end: start + ONE_MONTH_IN_SECS * 18,
      duration: ONE_MONTH_IN_SECS,
      unlocked: UNIT * 10n,
      total: UNIT * 1000n,
    });

    return {
      UNIT,
      ONE_MONTH_IN_SECS,
      ONE_QUATER_IN_SECS,
      token,
      vesting,
      owner,
      otherAccount,
    };
  }

  describe("Deployment", function () {
    it("The amount receive at the TGE should be equal to the amount of tokens that were unlocked", async function () {
      const { UNIT, token, vesting, owner, otherAccount } = await loadFixture(
        deployVestingFixture
      );
      // await time.increaseTo(unlockTime);
      expect(await token.balanceOf(await otherAccount.getAddress())).to.equal(
        UNIT * 10n
      );
    });
  });

  describe("After 1 year", function () {
    it("Test fun", async function () {
      const { UNIT, token, vesting, owner, otherAccount, ONE_MONTH_IN_SECS } =
        await loadFixture(deployVestingFixture);
      await vesting.startTGE();

      await time.increase(ONE_MONTH_IN_SECS * 1.1);

      const {
        start,
        end,
        duration,
        total,
        remaining,
        milestonClaimed,
        milestoneRelease,
      } = await vesting.getVestingSchedule(otherAccount);
      console.log(BigInt(await time.latest()) - start);
      console.log({
        start,
        end,
        total,
        remaining,
        milestonClaimed,
        milestoneRelease,
      });
      console.log(await vesting.balance(otherAccount));

      // await time.increaseTo(unlockTime);
      expect(await token.balanceOf(await otherAccount.getAddress())).to.equal(
        UNIT * 10n
      );
    });
  });
});
