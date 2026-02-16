import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { parseEther, Signer } from "ethers";
import hre from "hardhat";

const ONE_DAY = BigInt(24 * 60 * 60);
const ONE_MONTH = ONE_DAY * 30n;
const DEFAULT_LOCK_DURATION = 180n * ONE_DAY; // 180 days

describe("ONDelegate", function () {
  async function deployDelegateFixture() {
    const [owner, delegator1, delegator2, delegator3, beneficiary]: Signer[] =
      await hre.ethers.getSigners();

    // Deploy token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.connect(owner).deploy("Orochi Token", "ON");
    await token.waitForDeployment();

    // Mint tokens
    await token.connect(owner).mint();

    // Deploy ONDelegate
    const ONDelegate = await hre.ethers.getContractFactory("ONDelegate");
    const onDelegate = await ONDelegate.connect(owner).deploy(await token.getAddress());
    await onDelegate.waitForDeployment();

    // Transfer some tokens to delegators for testing
    await token
      .connect(owner)
      .transfer(await delegator1.getAddress(), parseEther("10000"));
    await token
      .connect(owner)
      .transfer(await delegator2.getAddress(), parseEther("10000"));
    await token
      .connect(owner)
      .transfer(await delegator3.getAddress(), parseEther("10000"));

    return {
      token,
      onDelegate,
      owner,
      delegator1,
      delegator2,
      delegator3,
      beneficiary,
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct token address", async function () {
      const { token, onDelegate } = await loadFixture(deployDelegateFixture);
      expect(await onDelegate.getToken()).to.equal(await token.getAddress());
    });

    it("Should set the correct owner", async function () {
      const { onDelegate, owner } = await loadFixture(deployDelegateFixture);
      expect(await onDelegate.owner()).to.equal(await owner.getAddress());
    });
  });

  describe("Whitelist Management", function () {
    it("Should allow owner to add delegators to whitelist", async function () {
      const { onDelegate, owner, delegator1, delegator2 } = await loadFixture(
        deployDelegateFixture
      );

      const addresses = [
        await delegator1.getAddress(),
        await delegator2.getAddress(),
      ];

      await expect(onDelegate.connect(owner).delegatorAdd(addresses))
        .to.emit(onDelegate, "DelegatorAdded")
        .withArgs(await delegator1.getAddress())
        .and.to.emit(onDelegate, "DelegatorAdded")
        .withArgs(await delegator2.getAddress());

      const delegation1 = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation1.whitelist).to.be.true;

      const delegation2 = await onDelegate.getDelegation(
        await delegator2.getAddress()
      );
      expect(delegation2.whitelist).to.be.true;
    });

    it("Should allow owner to remove delegators from whitelist", async function () {
      const { onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      const addresses = [await delegator1.getAddress()];

      // Add first
      await onDelegate.connect(owner).delegatorAdd(addresses);

      // Then remove
      await expect(onDelegate.connect(owner).delegatorRemove(addresses))
        .to.emit(onDelegate, "DelegatorRemoved")
        .withArgs(await delegator1.getAddress());

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.whitelist).to.be.false;
    });

    it("Should not emit event if whitelist status doesn't change", async function () {
      const { onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      const addresses = [await delegator1.getAddress()];

      // Add first time
      await onDelegate.connect(owner).delegatorAdd(addresses);

      // Try to add again - should not emit event
      const tx = await onDelegate.connect(owner).delegatorAdd(addresses);
      const receipt = await tx.wait();
      const events = receipt?.logs.filter(
        (log: any) => log.eventName === "DelegatorAdded"
      );
      expect(events?.length).to.equal(0);
    });

    it("Should revert if non-owner tries to add delegators", async function () {
      const { onDelegate, delegator1, delegator2 } = await loadFixture(
        deployDelegateFixture
      );

      const addresses = [await delegator2.getAddress()];

      await expect(
        onDelegate.connect(delegator1).delegatorAdd(addresses)
      ).to.be.revertedWithCustomError(onDelegate, "OwnableUnauthorizedAccount");
    });

    it("Should revert if non-owner tries to remove delegators", async function () {
      const { onDelegate, delegator1, delegator2 } = await loadFixture(
        deployDelegateFixture
      );

      const addresses = [await delegator2.getAddress()];

      await expect(
        onDelegate.connect(delegator1).delegatorRemove(addresses)
      ).to.be.revertedWithCustomError(onDelegate, "OwnableUnauthorizedAccount");
    });
  });

  describe("Delegation", function () {
    it("Should allow whitelisted delegator to delegate tokens", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      // Approve tokens
      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);

      // Delegate
      await expect(onDelegate.connect(delegator1).delegate(amount, 0))
        .to.emit(onDelegate, "NewDelegation")
        .withArgs(await delegator1.getAddress(), amount);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(amount);
    });

    it("Should use default lock duration when 0 is provided", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      // Approve and delegate
      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);

      const block = await hre.ethers.provider.getBlock("latest");
      const currentTime = BigInt(block!.timestamp);

      await onDelegate.connect(delegator1).delegate(amount, 0);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      // Should use default 180 days
      expect(delegation.unlockTime).to.be.greaterThan(
        currentTime + DEFAULT_LOCK_DURATION - 10n
      );
    });

    it("Should allow custom lock duration", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      // Approve and delegate with custom lock duration
      const amount = parseEther("1000");
      const customLock = ONE_MONTH;
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);

      const block = await hre.ethers.provider.getBlock("latest");
      const currentTime = BigInt(block!.timestamp);

      await onDelegate.connect(delegator1).delegate(amount, customLock);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.unlockTime).to.be.greaterThan(
        currentTime + customLock - 10n
      );
    });

    it("Should allow delegateAll to delegate entire balance", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const balance = await token.balanceOf(await delegator1.getAddress());

      // Approve tokens
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), balance);

      // Delegate all
      await expect(onDelegate.connect(delegator1).delegateAll(0))
        .to.emit(onDelegate, "NewDelegation")
        .withArgs(await delegator1.getAddress(), balance);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(balance);
    });

    it("Should accumulate delegation amounts", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount1 = parseEther("1000");
      const amount2 = parseEther("500");

      // First delegation
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount1);
      await onDelegate.connect(delegator1).delegate(amount1, 0);

      // Second delegation
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount2);
      await onDelegate.connect(delegator1).delegate(amount2, 0);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(amount1 + amount2);
    });

    it("Should revert if delegator is not whitelisted", async function () {
      const { token, onDelegate, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);

      await expect(
        onDelegate.connect(delegator1).delegate(amount, 0)
      ).to.be.revertedWithCustomError(onDelegate, "InvalidDelegator");
    });

    it("Should revert if allowance is insufficient", async function () {
      const { onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      // Don't approve tokens

      await expect(
        onDelegate.connect(delegator1).delegate(amount, 0)
      ).to.be.revertedWithCustomError(onDelegate, "InvalidDelegatedAmount");
    });

    it("Should revert if amount is zero", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      // Approve tokens
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), parseEther("1000"));

      await expect(
        onDelegate.connect(delegator1).delegate(0, 0)
      ).to.be.revertedWithCustomError(onDelegate, "InvalidDelegatedAmount");
    });
  });

  describe("Withdrawal", function () {
    it("Should allow delegator to withdraw after unlock time", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);

      // Delegate with short lock
      const lockDuration = ONE_DAY;
      await onDelegate.connect(delegator1).delegate(amount, lockDuration);

      // Fast forward time
      await time.increase(lockDuration + 1n);

      const initialBalance = await token.balanceOf(
        await delegator1.getAddress()
      );

      // Withdraw
      await expect(onDelegate.connect(delegator1).withdraw())
        .to.emit(onDelegate, "Refund")
        .withArgs(await delegator1.getAddress(), amount);

      const finalBalance = await token.balanceOf(await delegator1.getAddress());
      expect(finalBalance - initialBalance).to.equal(amount);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(0);
    });

    it("Should revert if trying to withdraw before unlock time", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);

      // Delegate with lock
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      // Try to withdraw immediately
      await expect(
        onDelegate.connect(delegator1).withdraw()
      ).to.be.revertedWithCustomError(onDelegate, "LockedDelegation");
    });

    it("Should revert if non-whitelisted tries to withdraw", async function () {
      const { onDelegate, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      await expect(
        onDelegate.connect(delegator1).withdraw()
      ).to.be.revertedWithCustomError(onDelegate, "InvalidDelegator");
    });
  });

  describe("Owner Refund", function () {
    it("Should allow owner to refund delegator's tokens", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      const initialBalance = await token.balanceOf(
        await delegator1.getAddress()
      );

      // Owner refunds
      await expect(
        onDelegate
          .connect(owner)
          .refund(await delegator1.getAddress(), amount)
      )
        .to.emit(onDelegate, "Refund")
        .withArgs(await delegator1.getAddress(), amount);

      const finalBalance = await token.balanceOf(await delegator1.getAddress());
      expect(finalBalance - initialBalance).to.equal(amount);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(0);
    });

    it("Should allow owner to do partial refund", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const totalAmount = parseEther("1000");
      const refundAmount = parseEther("300");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), totalAmount);
      await onDelegate.connect(delegator1).delegate(totalAmount, ONE_MONTH);

      // Owner refunds partially
      await onDelegate
        .connect(owner)
        .refund(await delegator1.getAddress(), refundAmount);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(totalAmount - refundAmount);
    });

    it("Should revert if non-owner tries to refund", async function () {
      const { onDelegate, delegator1, delegator2 } = await loadFixture(
        deployDelegateFixture
      );

      await expect(
        onDelegate
          .connect(delegator1)
          .refund(await delegator2.getAddress(), parseEther("100"))
      ).to.be.revertedWithCustomError(onDelegate, "OwnableUnauthorizedAccount");
    });

    it("Should revert if trying to refund non-whitelisted delegator", async function () {
      const { onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      await expect(
        onDelegate
          .connect(owner)
          .refund(await delegator1.getAddress(), parseEther("100"))
      ).to.be.revertedWithCustomError(onDelegate, "InvalidDelegator");
    });

    it("Should revert if refund amount is zero", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      await expect(
        onDelegate.connect(owner).refund(await delegator1.getAddress(), 0)
      ).to.be.revertedWithCustomError(onDelegate, "InvalidAmount");
    });

    it("Should revert if refund amount exceeds delegated amount", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      await expect(
        onDelegate
          .connect(owner)
          .refund(await delegator1.getAddress(), parseEther("1001"))
      ).to.be.revertedWithCustomError(onDelegate, "InvalidAmount");
    });
  });

  describe("Complete Function", function () {
    it("Should allow owner to complete delegation to beneficiary", async function () {
      const { token, onDelegate, owner, delegator1, beneficiary } =
        await loadFixture(deployDelegateFixture);

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      const initialBalance = await token.balanceOf(
        await beneficiary.getAddress()
      );

      // Complete delegation
      await expect(
        onDelegate
          .connect(owner)
          .complete(
            await delegator1.getAddress(),
            await beneficiary.getAddress(),
            amount
          )
      )
        .to.emit(onDelegate, "Complete")
        .withArgs(
          await delegator1.getAddress(),
          await beneficiary.getAddress(),
          amount
        );

      const finalBalance = await token.balanceOf(
        await beneficiary.getAddress()
      );
      expect(finalBalance - initialBalance).to.equal(amount);

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(0);
    });

    it("Should allow partial completion", async function () {
      const { token, onDelegate, owner, delegator1, beneficiary } =
        await loadFixture(deployDelegateFixture);

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const totalAmount = parseEther("1000");
      const completeAmount = parseEther("600");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), totalAmount);
      await onDelegate.connect(delegator1).delegate(totalAmount, ONE_MONTH);

      // Complete partially
      await onDelegate
        .connect(owner)
        .complete(
          await delegator1.getAddress(),
          await beneficiary.getAddress(),
          completeAmount
        );

      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(totalAmount - completeAmount);
    });

    it("Should revert if delegator equals beneficiary", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      // Try to complete to same address
      await expect(
        onDelegate
          .connect(owner)
          .complete(
            await delegator1.getAddress(),
            await delegator1.getAddress(),
            amount
          )
      ).to.be.revertedWithCustomError(onDelegate, "InvalidBeneficiary");
    });

    it("Should revert if non-owner tries to complete", async function () {
      const { onDelegate, delegator1, beneficiary } = await loadFixture(
        deployDelegateFixture
      );

      await expect(
        onDelegate
          .connect(delegator1)
          .complete(
            await delegator1.getAddress(),
            await beneficiary.getAddress(),
            parseEther("100")
          )
      ).to.be.revertedWithCustomError(onDelegate, "OwnableUnauthorizedAccount");
    });

    it("Should revert if trying to complete non-whitelisted delegator", async function () {
      const { onDelegate, owner, delegator1, beneficiary } = await loadFixture(
        deployDelegateFixture
      );

      await expect(
        onDelegate
          .connect(owner)
          .complete(
            await delegator1.getAddress(),
            await beneficiary.getAddress(),
            parseEther("100")
          )
      ).to.be.revertedWithCustomError(onDelegate, "InvalidDelegator");
    });

    it("Should revert if complete amount is zero", async function () {
      const { token, onDelegate, owner, delegator1, beneficiary } =
        await loadFixture(deployDelegateFixture);

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      await expect(
        onDelegate
          .connect(owner)
          .complete(
            await delegator1.getAddress(),
            await beneficiary.getAddress(),
            0
          )
      ).to.be.revertedWithCustomError(onDelegate, "InvalidAmount");
    });

    it("Should revert if complete amount exceeds delegated amount", async function () {
      const { token, onDelegate, owner, delegator1, beneficiary } =
        await loadFixture(deployDelegateFixture);

      // Add to whitelist and delegate
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_MONTH);

      await expect(
        onDelegate
          .connect(owner)
          .complete(
            await delegator1.getAddress(),
            await beneficiary.getAddress(),
            parseEther("1001")
          )
      ).to.be.revertedWithCustomError(onDelegate, "InvalidAmount");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple delegators independently", async function () {
      const { token, onDelegate, owner, delegator1, delegator2 } =
        await loadFixture(deployDelegateFixture);

      // Add both to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([
          await delegator1.getAddress(),
          await delegator2.getAddress(),
        ]);

      // Delegator 1 delegates
      const amount1 = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount1);
      await onDelegate.connect(delegator1).delegate(amount1, ONE_DAY);

      // Delegator 2 delegates
      const amount2 = parseEther("2000");
      await token
        .connect(delegator2)
        .approve(await onDelegate.getAddress(), amount2);
      await onDelegate.connect(delegator2).delegate(amount2, ONE_MONTH);

      const delegation1 = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      const delegation2 = await onDelegate.getDelegation(
        await delegator2.getAddress()
      );

      expect(delegation1.amount).to.equal(amount1);
      expect(delegation2.amount).to.equal(amount2);
      expect(delegation1.unlockTime).to.not.equal(delegation2.unlockTime);
    });

    it("Should properly update unlock time on subsequent delegations", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      // Add to whitelist
      await onDelegate
        .connect(owner)
        .delegatorAdd([await delegator1.getAddress()]);

      // First delegation with 1 day lock
      const amount1 = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount1);
      await onDelegate.connect(delegator1).delegate(amount1, ONE_DAY);

      const delegation1 = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      const firstUnlockTime = delegation1.unlockTime;

      // Wait a bit
      await time.increase(100n);

      // Second delegation with 1 month lock
      const amount2 = parseEther("500");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount2);
      await onDelegate.connect(delegator1).delegate(amount2, ONE_MONTH);

      const delegation2 = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );

      // Unlock time should be updated to the new delegation's unlock time
      expect(delegation2.unlockTime).to.be.greaterThan(firstUnlockTime);
      expect(delegation2.amount).to.equal(amount1 + amount2);
    });

    it("Should allow delegation after being removed and re-added to whitelist", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      const addresses = [await delegator1.getAddress()];

      // Add to whitelist
      await onDelegate.connect(owner).delegatorAdd(addresses);

      // Delegate
      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_DAY);

      // Remove from whitelist
      await onDelegate.connect(owner).delegatorRemove(addresses);

      // Cannot delegate anymore
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await expect(
        onDelegate.connect(delegator1).delegate(amount, ONE_DAY)
      ).to.be.revertedWithCustomError(onDelegate, "InvalidDelegator");

      // Re-add to whitelist
      await onDelegate.connect(owner).delegatorAdd(addresses);

      // Should be able to delegate again
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await expect(onDelegate.connect(delegator1).delegate(amount, ONE_DAY))
        .to.emit(onDelegate, "NewDelegation")
        .withArgs(await delegator1.getAddress(), amount);
    });

    it("Should maintain delegation data after removing from whitelist", async function () {
      const { token, onDelegate, owner, delegator1 } = await loadFixture(
        deployDelegateFixture
      );

      const addresses = [await delegator1.getAddress()];

      // Add to whitelist and delegate
      await onDelegate.connect(owner).delegatorAdd(addresses);

      const amount = parseEther("1000");
      await token
        .connect(delegator1)
        .approve(await onDelegate.getAddress(), amount);
      await onDelegate.connect(delegator1).delegate(amount, ONE_DAY);

      // Remove from whitelist
      await onDelegate.connect(owner).delegatorRemove(addresses);

      // Check delegation data is still there
      const delegation = await onDelegate.getDelegation(
        await delegator1.getAddress()
      );
      expect(delegation.amount).to.equal(amount);
      expect(delegation.whitelist).to.be.false;
    });
  });
});
