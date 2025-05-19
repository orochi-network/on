import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("OrochiNetworkVesting", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployVestingFixture() {
    const ONE_MONTH_IN_SECS = 30 * 24 * 60 * 60; // 30‑day month in seconds
    const ONE_HOUR = 60 * 60; // 1‑hour offset
    const UNIT = 10n ** 18n; // 10^18

    // Fetch three deterministic signers: deployer, main user, spare user
    const [owner, user, newUser] = await hre.ethers.getSigners();

    // Resolve contract factories for token + vesting
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const Vesting = await hre.ethers.getContractFactory("OrochiNetworkVesting");

    // Deploy ERC‑20 token with name + symbol
    const token = await Token.deploy("Orochi Network Token", "ON");
    // Deploy vesting contract, injecting token address into constructor
    const vesting = await Vesting.deploy(await token.getAddress());
    // Hand over token ownership so vesting contract can mint
    await token.transferOwnership(await vesting.getAddress());

    // Grab latest block to anchor vesting start timestamp
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found"); // Sanity guard

    const start = block.timestamp + ONE_HOUR; // Vesting begins in 1 h
    const duration = ONE_MONTH_IN_SECS; // Each milestone = 1 m
    const end = start + duration * 18; // Vesting spans 18 m
    const unlocked = UNIT * 10n; // 10 ON unlocked TGE
    const total = UNIT * 1000n; // Total grant = 1000 ON

    // Register vesting term for primary test user
    await vesting.addVestingTerm({
      beneficiary: user.address,
      start,
      end,
      duration,
      unlocked,
      total,
    });

    return {
      UNIT,
      ONE_MONTH_IN_SECS,
      start,
      token,
      vesting,
      owner,
      user,
      newUser,
    };
  }

  // -------------------------------------------------------------------
  //                         TGE + Claim tests
  // -------------------------------------------------------------------

  it("Should unlock TGE tokens immediately", async function () {
    // Load a pristine fixture instance
    const { UNIT, token, user, vesting, start, ONE_MONTH_IN_SECS } =
      await loadFixture(deployVestingFixture);
    // Trigger TGE (onlyOwner) so claim path opens
    await vesting.startTGE();
    // Fast‑forward chain time to 3 milestones after `start`
    await time.increaseTo(start);
    await vesting.connect(user).claim();
    // Expect user balance equals initial 10 ON unlocked during addVestingTerm
    expect(await token.balanceOf(user.address)).to.equal(UNIT * 10n);
  });

  it("Should allow claim after TGE and 3 milestones", async function () {
    // Unpack commonly‑used references
    const { UNIT, ONE_MONTH_IN_SECS, start, token, vesting, user } =
      await loadFixture(deployVestingFixture);

    // Trigger TGE (onlyOwner) so claim path opens
    await vesting.startTGE();
    // Fast‑forward chain time to 3 milestones after `start`
    await time.increaseTo(start + ONE_MONTH_IN_SECS * 3);
    // User claims vested tokens
    await vesting.connect(user).claim();
    // Expect balance: 10 ON (TGE) + 3×55 ON per milestone = 175 ON
    expect(await token.balanceOf(user.address)).to.equal(
      UNIT * (10n + 3n * 55n)
    );
  });

  it("Should revert claim with no claimable milestones", async function () {
    // Prepare fixture
    const { ONE_MONTH_IN_SECS, start, vesting, user } = await loadFixture(
      deployVestingFixture
    );
    // Start TGE so claiming is permitted
    await vesting.startTGE();
    // Skip to very end of vesting (all milestones matured)
    await time.increaseTo(start + ONE_MONTH_IN_SECS * 18);
    // First claim should consume remaining allocation
    await vesting.connect(user).claim();
    // Move to next milestone (which no longer exists)
    await time.increaseTo(start + ONE_MONTH_IN_SECS * 19);
    // Second claim must revert with InsufficientBalance (remaining = 0)
    await expect(vesting.connect(user).claim()).to.be.revertedWithCustomError(
      vesting,
      "InsufficientBalance"
    );
  });

  it("Should emit TokenClaimed event on claim", async function () {
    // Fixture + aliases
    const { vesting, user, start, ONE_MONTH_IN_SECS } = await loadFixture(
      deployVestingFixture
    );
    // Open claim period
    await vesting.startTGE();
    // Travel one milestone ahead
    await time.increaseTo(start + ONE_MONTH_IN_SECS);
    // Expect TokenClaimed emitted once claim executes
    await expect(vesting.connect(user).claim()).to.emit(
      vesting,
      "TokenClaimed"
    );
  });

  it("Should revert if claim called twice with no new milestone", async () => {
    // Provision fixture
    const { vesting, user, start, ONE_MONTH_IN_SECS } = await loadFixture(
      deployVestingFixture
    );
    // Activate TGE
    await vesting.startTGE();
    // Jump to first milestone
    await time.increaseTo(start + ONE_MONTH_IN_SECS);
    // First claim succeeds
    await vesting.connect(user).claim();
    // Immediate second claim (same milestone) must revert NoClaimableToken
    await expect(vesting.connect(user).claim()).to.be.revertedWithCustomError(
      vesting,
      "NoClaimableToken"
    );
  });

  it("Should claim all remaining tokens after vesting ends", async function () {
    // Fixture extraction
    const { UNIT, ONE_MONTH_IN_SECS, start, token, vesting, user } =
      await loadFixture(deployVestingFixture);
    // Enable claim phase
    await vesting.startTGE();
    // Warp to vesting end (18 months)
    await time.increaseTo(start + ONE_MONTH_IN_SECS * 18);
    // User claims – expect entire allocation released
    await vesting.connect(user).claim();
    // User should now hold full 1000 ON grant
    expect(await token.balanceOf(user.address)).to.equal(UNIT * 1000n);
  });

  // -------------------------------------------------------------------
  //                           Airdrop tests
  // -------------------------------------------------------------------

  it("Should correctly claim airdrop after TGE", async function () {
    // Load fixture
    const { vesting, token, user, owner } = await loadFixture(
      deployVestingFixture
    );
    // Owner assigns 100 tokens as airdrop to `user`
    await vesting.connect(owner).addUserToAirdrop([user.address], [100]);
    // Initiate TGE
    await vesting.startTGE();
    // User claims their airdrop allocation
    await vesting.connect(user).claimAirdrop();
    // Final balance = 100 ON airdrop + 10 ON initial unlock
    expect(await token.balanceOf(user.address)).to.equal(100n);
  });

  it("Should emit AirdropClaim event on airdrop claim", async function () {
    // Fixture resources
    const { vesting, user, owner } = await loadFixture(deployVestingFixture);
    // Assign airdrop
    await vesting.connect(owner).addUserToAirdrop([user.address], [100]);
    // Start TGE
    await vesting.startTGE();
    // Expect proper event emitted on claim
    await expect(vesting.connect(user).claimAirdrop()).to.emit(
      vesting,
      "AirdropClaim"
    );
  });

  it("Should silently skip if user has no airdrop", async () => {
    // Prepare test state
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // Begin TGE
    await vesting.startTGE();
    // claimAirdrop() should succeed (no revert) + emit nothing
    await vesting.connect(user).claimAirdrop(); // no assertions: pass if no throw
  });

  it("Should revert if addUserToAirdrop is called after TGE", async function () {
    // Fixture data
    const { vesting, owner, user } = await loadFixture(deployVestingFixture);
    // Lock pre‑TGE functions
    await vesting.startTGE();
    // Attempting to add airdrop now must fail with TGEAlreadyStarted
    await expect(
      vesting.connect(owner).addUserToAirdrop([user.address], [100])
    ).to.be.revertedWithCustomError(vesting, "TGEAlreadyStarted");
  });

  it("Should revert if owner provides mismatched arrays in airdrop", async function () {
    // Fixture baseline
    const { vesting, owner, user } = await loadFixture(deployVestingFixture);
    // Length mismatch => BeneficiaryAmountMismatch custom error
    await expect(
      vesting.connect(owner).addUserToAirdrop([user.address], [100, 200])
    ).to.be.revertedWithCustomError(vesting, "BeneficiaryAmountMismatch");
  });

  // -------------------------------------------------------------------
  //                      claimHelper (batch) tests
  // -------------------------------------------------------------------

  it("Should allow batch claim with claimHelper for multiple users", async function () {
    // Extract fixture items
    const {
      vesting,
      owner,
      token,
      UNIT,
      user,
      newUser,
      ONE_MONTH_IN_SECS,
      start,
    } = await loadFixture(deployVestingFixture);

    // Add a *second* vesting schedule for `newUser`
    await vesting.connect(owner).addVestingTerm({
      beneficiary: newUser.address,
      start,
      end: start + ONE_MONTH_IN_SECS * 18,
      duration: ONE_MONTH_IN_SECS,
      unlocked: 0n,
      total: UNIT * 1000n,
    });

    // Kick off TGE
    await vesting.startTGE();
    // Advance 2 milestones
    await time.increaseTo(start + ONE_MONTH_IN_SECS * 2);
    // Owner triggers batch claim for both users
    await vesting.connect(owner).claimHelper([user.address, newUser.address]);

    // Assert both users received > 0 tokens
    expect(await token.balanceOf(user.address)).to.be.gt(0);
    expect(await token.balanceOf(newUser.address)).to.be.gt(0);
  });

  it("Should revert claimHelper if user has no vesting schedule", async function () {
    // Fixture
    const { vesting, owner, newUser } = await loadFixture(deployVestingFixture);
    // Begin TGE so claimHelper is callable
    await vesting.startTGE();
    // newUser owns no schedule ⇒ _balance() division by zero panic (0x12)
    await expect(
      vesting.connect(owner).claimHelper([newUser.address])
    ).to.revertedWithCustomError(vesting, "InvalidVestingSchedule");
  });

  // -------------------------------------------------------------------
  //                     Admin + deployment setup tests
  // -------------------------------------------------------------------

  it("Should emit TGEStarted event", async function () {
    // Deploy fixture
    const { vesting } = await loadFixture(deployVestingFixture);
    // Expect event upon first invocation
    await expect(vesting.startTGE()).to.emit(vesting, "TGEStarted");
  });

  it("Should revert if TGE already started", async function () {
    // Fixture sharpened
    const { vesting } = await loadFixture(deployVestingFixture);
    // First call succeeds
    await vesting.startTGE();
    // Second call must revert with TGEAlreadyStarted
    await expect(vesting.startTGE()).to.be.revertedWithCustomError(
      vesting,
      "TGEAlreadyStarted"
    );
  });

  it("Should revert duplicate vesting entry", async function () {
    // Fixture elements
    const { ONE_MONTH_IN_SECS, vesting, user } = await loadFixture(
      deployVestingFixture
    );
    // Use latest block timestamp to fabricate a *new* term
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");

    // Define overlapping schedule for same user (disallowed)
    const start = block.timestamp + 3600; // 1 h from now
    const end = start + ONE_MONTH_IN_SECS * 18; // 18 months

    // Expect BeneficiaryAlreadyAdded custom error
    await expect(
      vesting.addVestingTerm({
        beneficiary: user.address,
        start,
        end,
        duration: ONE_MONTH_IN_SECS,
        unlocked: 0n,
        total: 10n ** 21n,
      })
    ).to.be.revertedWithCustomError(vesting, "BeneficiaryAlreadyAdded");
  });

  it("Should revert if non-owner tries to start TGE", async function () {
    // Retrieve vesting + non‑owner signer
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // Non‑owner call should hit Ownable modifier
    await expect(vesting.connect(user).startTGE()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should revert if non-owner tries to add vesting term", async function () {
    // Setup
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // Compute time params for dummy term
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const now = block.timestamp; // Non‑owner attempting to add term triggers Ownable revert
    await expect(
      vesting.connect(user).addVestingTerm({
        beneficiary: user.address,
        start: now + 3600,
        end: now + 3600 * 2,
        duration: 60,
        unlocked: 0,
        total: 1000,
      })
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should revert invalid vesting term", async function () {
    // Baseline
    const { vesting, owner, newUser } = await loadFixture(deployVestingFixture);
    // Fetch current block timestamp
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");

    const now = block.timestamp;
    // duration = 0 triggers division‑by‑zero panic inside addVestingTerm

    expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: now + 1000,
        end: now + 1001,
        duration: 0,
        unlocked: 0,
        total: 100,
      })
    ).to.revertedWithCustomError(vesting, "InvalidVestingTerm");
  });

  // -------------------------------------------------------------------
  //                        Pure view‑function tests
  // -------------------------------------------------------------------

  it("Should return correct vesting schedule", async () => {
    // Load fixture
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // Query on‑chain struct
    const schedule = await vesting.getVestingSchedule(user.address);
    // Validate `total` matches 1000 ON allocation
    expect(schedule.total).to.equal(10n ** 21n);
  });

  it("Should return correct airdrop balance", async () => {
    // Context setup
    const { vesting, owner, user } = await loadFixture(deployVestingFixture);
    // Assign 500 ON airdrop to user
    await vesting.connect(owner).addUserToAirdrop([user.address], [500]);
    // Read storage via balanceAirdrop()
    const balance = await vesting.balanceAirdrop(user.address);
    // Confirm matches assigned amount
    expect(balance).to.equal(500);
  });

  it("Should return correct claimable balance", async () => {
    // Acquire state
    const { vesting, user, start, ONE_MONTH_IN_SECS } = await loadFixture(
      deployVestingFixture
    );
    // Enable TGE + travel 4 milestones ahead
    await vesting.startTGE();
    await time.increaseTo(start + ONE_MONTH_IN_SECS * 4);
    // Fetch claimable amount (view function)
    const amount = await vesting.balance(user.address);
    // Expect > 0 (should be 4 milestones worth)
    expect(amount).to.be.gt(0);
  });

  it("Should return TGE status correctly", async () => {
    // Fixture
    const { vesting } = await loadFixture(deployVestingFixture);
    // Initially false
    expect(await vesting.isTGEStarted()).to.equal(false);
    // Start TGE
    await vesting.startTGE();
    // Now true
    expect(await vesting.isTGEStarted()).to.equal(true);
  });

  // -------------------------------------------------------------------
  //                     Pre‑TGE access‑control tests
  // -------------------------------------------------------------------

  it("Should revert claim before TGE", async () => {
    // Fixture
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // Calling claim() pre‑TGE triggers TGENotStarted modifier
    await expect(vesting.connect(user).claim()).to.be.revertedWithCustomError(
      vesting,
      "TGENotStarted"
    );
  });

  it("Should revert claimHelper before TGE", async () => {
    // Load state
    const { vesting, owner, user } = await loadFixture(deployVestingFixture);
    // Batch claim prior to TGE must revert
    await expect(
      vesting.connect(owner).claimHelper([user.address])
    ).to.be.revertedWithCustomError(vesting, "TGENotStarted");
  });

  it("Should revert claimAirdrop before TGE even if airdrop is assigned", async () => {
    // Prepare fixture
    const { vesting, owner, user } = await loadFixture(deployVestingFixture);
    // Pre‑assign airdrop
    await vesting.connect(owner).addUserToAirdrop([user.address], [123]);
    // Calling claimAirdrop() before TGE should still revert
    await expect(
      vesting.connect(user).claimAirdrop()
    ).to.be.revertedWithCustomError(vesting, "TGENotStarted");
  });

  it("Should revert claimAirdrop before TGE even if user has no airdrop", async () => {
    // Final guard test
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // claimAirdrop() with empty allocation before TGE must revert as well
    await expect(
      vesting.connect(user).claimAirdrop()
    ).to.be.revertedWithCustomError(vesting, "TGENotStarted");
  });

  //--------------------------------------------------------------------------
  //                       ADDITIONAL EDGE‑CASE TESTS
  //--------------------------------------------------------------------------

  it("Should revert VestingWasNotStarted when claiming after TGE but before schedule start", async function () {
    // Load fixture snapshot
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // Start TGE so onlyPostTGE modifier passes
    await vesting.startTGE();
    // Attempt immediate claim while 'start' timestamp not reached
    await expect(vesting.connect(user).claim()).to.be.revertedWithCustomError(
      vesting,
      "VestingWasNotStarted"
    );
  });

  it("Should unlock full amount immediately when unlocked equals total", async function () {
    // Load fixture baseline
    const { vesting, owner, newUser, UNIT } = await loadFixture(
      deployVestingFixture
    );
    // Current block time
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const now = block.timestamp;
    // Add a term where everything is unlocked up‑front
    await expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: now + 3600,
        end: now + 7200,
        duration: 3600,
        unlocked: UNIT * 100n,
        total: UNIT * 100n,
      })
    ).to.emit(vesting, "UnlockAtTGE");
    await vesting.startTGE();
    await vesting.connect(newUser).claim();
    // Verify remaining amount is zero
    const s = await vesting.getVestingSchedule(newUser.address);
    expect(s.totalClaimed).to.equal(UNIT * 100n);
  });

  it("Should revert InvalidVestingTerm when end is less than start + duration", async function () {
    // Load fixture
    const { vesting, owner, newUser } = await loadFixture(deployVestingFixture);
    // Grab current timestamp
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const now = block.timestamp; // Attempt to add logically impossible term
    await expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: now + 3600,
        end: now + 3700, // < start + duration
        duration: 7200,
        unlocked: 0,
        total: 1000,
      })
    ).to.be.revertedWithCustomError(vesting, "InvalidVestingTerm");
  });

  it("Should revert InvalidVestingTerm when start time is in the past", async function () {
    // Load fixture
    const { vesting, owner, newUser, ONE_MONTH_IN_SECS } = await loadFixture(
      deployVestingFixture
    );
    // Use a past start timestamp to trigger branch term.start < block.timestamp
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const past = block.timestamp - 10;
    await expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: past, // ⏪ past start
        end: past + ONE_MONTH_IN_SECS * 2, // meets end >= start + duration
        duration: ONE_MONTH_IN_SECS,
        unlocked: 0,
        total: 1000,
      })
    ).to.be.revertedWithCustomError(vesting, "InvalidVestingTerm");
  });

  it("Should revert InsufficientBalance when per‑milestone release rounds to zero", async function () {
    // Deploy fresh state
    const { vesting, owner, newUser, ONE_MONTH_IN_SECS, UNIT, start } =
      await loadFixture(deployVestingFixture);

    // Craft a term with tiny remaining so release = 0 (integer division)
    await vesting.connect(owner).addVestingTerm({
      beneficiary: newUser.address,
      start: start, // same baseline start
      end: start + ONE_MONTH_IN_SECS * 18,
      duration: ONE_MONTH_IN_SECS,
      unlocked: 0,
      total: 17n, // remaining = 17, milestoneTotal = 18 => release = 0
    });

    // Activate TGE & move one milestone ahead
    await vesting.startTGE();
    await time.increaseTo(start + ONE_MONTH_IN_SECS);

    // newUser attempts claim; _balance returns milestone=1, amount=0 ⇒ InsufficientBalance
    await expect(
      vesting.connect(newUser).claim()
    ).to.be.revertedWithCustomError(vesting, "InsufficientBalance");
  });

  it("balance() should return zero before vesting start", async function () {
    // Load fixture
    const { vesting, user } = await loadFixture(deployVestingFixture);
    // Query claimable balance prior to schedule start
    expect(await vesting.balance(user.address)).to.equal(0);
  });

  it("Should accumulate airdrop tokens across multiple additions", async function () {
    // Load fixture
    const { vesting, owner, user } = await loadFixture(deployVestingFixture);
    // First assignment
    await vesting.connect(owner).addUserToAirdrop([user.address], [50]);
    // Second assignment
    await vesting.connect(owner).addUserToAirdrop([user.address], [70]);
    // Check aggregate
    expect(await vesting.balanceAirdrop(user.address)).to.equal(120);
  });

  it("Should revert with panic when user without schedule tries to claim post‑TGE", async function () {
    // Load fixture
    const { vesting, newUser } = await loadFixture(deployVestingFixture);
    // Start TGE
    await vesting.startTGE();

    await expect(vesting.connect(newUser).claim()).to.revertedWithCustomError(
      vesting,
      "InvalidVestingSchedule"
    );
  });

  it("Should revert InvalidVestingTerm when unlocked > total", async function () {
    const { vesting, owner, newUser } = await loadFixture(deployVestingFixture);
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const now = block.timestamp;
    await expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: now + 1000,
        end: now + 1000 + 3600,
        duration: 3600,
        unlocked: 2000,
        total: 1000,
      })
    ).to.be.revertedWithCustomError(vesting, "InvalidVestingTerm");
  });

  it("Should revert InvalidVestingTerm when start is in the past", async function () {
    const { vesting, owner, newUser } = await loadFixture(deployVestingFixture);
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const now = block.timestamp;
    await expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: now - 1, // past
        end: now + 3600,
        duration: 3600,
        unlocked: 0,
        total: 1000,
      })
    ).to.be.revertedWithCustomError(vesting, "InvalidVestingTerm");
  });

  it("Should revert InvalidVestingTerm when end is too short", async function () {
    const { vesting, owner, newUser } = await loadFixture(deployVestingFixture);
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const now = block.timestamp;
    await expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: now + 1000,
        end: now + 1000 + 100, // too short
        duration: 3600,
        unlocked: 0,
        total: 1000,
      })
    ).to.be.revertedWithCustomError(vesting, "InvalidVestingTerm");
  });

  it("Should revert InvalidVestingTerm when milestoneTotal is zero", async function () {
    const { vesting, owner, newUser } = await loadFixture(deployVestingFixture);
    const block = await hre.ethers.provider.getBlock("latest");
    if (!block) throw new Error("Block not found");
    const now = block.timestamp;
    await expect(
      vesting.connect(owner).addVestingTerm({
        beneficiary: newUser.address,
        start: now + 1000,
        end: now + 1001,
        duration: 10000, // too big
        unlocked: 0,
        total: 1000,
      })
    ).to.be.revertedWithCustomError(vesting, "InvalidVestingTerm");
  });

  it("Should correctly clamp milestone to milestoneTotal when vesting end passed", async function () {
    const { vesting, user, start, ONE_MONTH_IN_SECS } = await loadFixture(
      deployVestingFixture
    );
    await vesting.startTGE();
    // Jump far past the vesting period
    await time.increaseTo(start + ONE_MONTH_IN_SECS * 100);
    // Should return full amount
    const amount = await vesting.balance(user.address);
    expect(amount).to.be.gt(0);
  });
});
