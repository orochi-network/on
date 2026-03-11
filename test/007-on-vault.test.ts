import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { parseEther, Signer, ZeroAddress } from "ethers";
import hre from "hardhat";
import { DEPLOYED_ADDRESS } from "../deployed/deployed";

const ONE_DAY = BigInt(24 * 60 * 60);
const ONE_MONTH = ONE_DAY * 30n;
const ONE_YEAR = ONE_DAY * 365n;

describe("ONVault", function () {
  async function deployVaultFixture() {
    const [owner, user, other, beneficiary]: Signer[] =
      await hre.ethers.getSigners();

    // Deploy ERC20 token
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.connect(owner).deploy("Orochi Token", "ON");
    await token.waitForDeployment();
    await token.connect(owner).mint();

    // Deploy ONVault
    const ONVault = await hre.ethers.getContractFactory("ONVault");
    const vault = await ONVault.connect(owner).deploy(
      await owner.getAddress(),
      await user.getAddress()
    );
    await vault.waitForDeployment();

    // Fund vault with ERC20 tokens
    await token
      .connect(owner)
      .transfer(await vault.getAddress(), parseEther("10000"));

    return { token, vault, owner, user, other, beneficiary };
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);
      expect(await vault.owner()).to.equal(await owner.getAddress());
    });

    it("Should set the correct user", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      expect(await vault.getUser()).to.equal(await user.getAddress());
    });

    it("Should set expireTime to deploy timestamp + 90 days", async function () {
      const { vault } = await loadFixture(deployVaultFixture);
      const latestBlock = await hre.ethers.provider.getBlock("latest");
      const expireTime = await vault.getExpireTime();
      expect(expireTime).to.be.closeTo(
        BigInt(latestBlock!.timestamp) + ONE_DAY * 90n,
        10n
      );
    });

    it("Should have default token set to ON Token", async function () {
      const { vault } = await loadFixture(deployVaultFixture);
      expect(await vault.getTokenAddress()).to.equal(
        DEPLOYED_ADDRESS.onToken.address
      );
    });

    it("Should revert if owner address is zero", async function () {
      const [, user]: Signer[] = await hre.ethers.getSigners();
      const ONVault = await hre.ethers.getContractFactory("ONVault");
      await expect(
        ONVault.deploy(ZeroAddress, await user.getAddress())
      ).to.be.revertedWithCustomError(ONVault, "OwnableInvalidOwner");
    });

    it("Should revert if user address is zero", async function () {
      const [owner]: Signer[] = await hre.ethers.getSigners();
      const ONVault = await hre.ethers.getContractFactory("ONVault");
      await expect(
        ONVault.deploy(await owner.getAddress(), ZeroAddress)
      ).to.be.revertedWithCustomError(ONVault, "InvalidAddress");
    });

    it("Should reject native token deposits", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);
      await expect(
        owner.sendTransaction({
          to: await vault.getAddress(),
          value: parseEther("1"),
        })
      ).to.be.reverted;
    });
  });

  describe("Owner: setToken", function () {
    it("Should allow owner to set ERC20 token address", async function () {
      const { vault, token, owner } = await loadFixture(deployVaultFixture);
      const tokenAddr = await token.getAddress();
      await expect(vault.connect(owner).setToken(tokenAddr))
        .to.emit(vault, "TokenSet")
        .withArgs(tokenAddr);
      expect(await vault.getTokenAddress()).to.equal(tokenAddr);
    });

    it("Should revert if token address is zero", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);
      await expect(
        vault.connect(owner).setToken(ZeroAddress)
      ).to.be.revertedWithCustomError(vault, "InvalidTokenAddress");
    });

    it("Should revert if non-owner calls setToken", async function () {
      const { vault, user, token } = await loadFixture(deployVaultFixture);
      await expect(
        vault.connect(user).setToken(await token.getAddress())
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Owner: transfer", function () {
    it("Should allow owner to transfer ERC20 tokens", async function () {
      const { vault, token, owner, beneficiary } =
        await loadFixture(deployVaultFixture);
      const tokenAddr = await token.getAddress();
      const beneficiaryAddr = await beneficiary.getAddress();

      await vault.connect(owner).setToken(tokenAddr);

      const amount = parseEther("500");
      await expect(vault.connect(owner).transfer(beneficiaryAddr, amount))
        .to.emit(vault, "TokenTransferred")
        .withArgs(tokenAddr, beneficiaryAddr, amount);

      expect(await token.balanceOf(beneficiaryAddr)).to.equal(amount);
    });

    it("Should revert if transfer with default token that has no balance on test chain", async function () {
      const { vault, owner, beneficiary } =
        await loadFixture(deployVaultFixture);
      // Default token (ON Token mainnet address) does not exist on the test chain
      await expect(
        vault
          .connect(owner)
          .transfer(await beneficiary.getAddress(), parseEther("100"))
      ).to.be.reverted;
    });

    it("Should revert if recipient is zero address", async function () {
      const { vault, token, owner } = await loadFixture(deployVaultFixture);
      await vault.connect(owner).setToken(await token.getAddress());
      await expect(
        vault.connect(owner).transfer(ZeroAddress, parseEther("100"))
      ).to.be.revertedWithCustomError(vault, "InvalidBeneficiary");
    });

    it("Should revert if amount is zero", async function () {
      const { vault, token, owner, beneficiary } =
        await loadFixture(deployVaultFixture);
      await vault.connect(owner).setToken(await token.getAddress());
      await expect(
        vault.connect(owner).transfer(await beneficiary.getAddress(), 0n)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("Should revert if non-owner calls transfer", async function () {
      const { vault, token, owner, user, beneficiary } =
        await loadFixture(deployVaultFixture);
      await vault.connect(owner).setToken(await token.getAddress());
      await expect(
        vault
          .connect(user)
          .transfer(await beneficiary.getAddress(), parseEther("100"))
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("User: extendExpireTime", function () {
    it("Should allow user to extend expire time by 1 month", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const expireBefore = await vault.getExpireTime();
      await expect(vault.connect(user).extendExpireTime(ONE_MONTH))
        .to.emit(vault, "ExpireTimeExtended")
        .withArgs(expireBefore + ONE_MONTH);
      expect(await vault.getExpireTime()).to.equal(expireBefore + ONE_MONTH);
    });

    it("Should allow user to extend expire time by 12 months", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const expireBefore = await vault.getExpireTime();
      await expect(vault.connect(user).extendExpireTime(ONE_YEAR))
        .to.emit(vault, "ExpireTimeExtended")
        .withArgs(expireBefore + ONE_YEAR);
      expect(await vault.getExpireTime()).to.equal(expireBefore + ONE_YEAR);
    });

    it("Should revert if duration is less than 30 days", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      await expect(
        vault.connect(user).extendExpireTime(ONE_DAY * 29n)
      ).to.be.revertedWithCustomError(vault, "InvalidDuration");
    });

    it("Should revert if duration is more than 365 days", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      await expect(
        vault.connect(user).extendExpireTime(ONE_YEAR + 1n)
      ).to.be.revertedWithCustomError(vault, "InvalidDuration");
    });

    it("Should revert if non-user calls extendExpireTime", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);
      await expect(
        vault.connect(owner).extendExpireTime(ONE_MONTH)
      ).to.be.revertedWithCustomError(vault, "InvalidUser");
    });

    it("Should allow multiple extensions", async function () {
      const { vault, user } = await loadFixture(deployVaultFixture);
      const expireBefore = await vault.getExpireTime();
      await vault.connect(user).extendExpireTime(ONE_MONTH);
      await vault.connect(user).extendExpireTime(ONE_MONTH);
      expect(await vault.getExpireTime()).to.equal(
        expireBefore + ONE_MONTH * 2n
      );
    });
  });

  describe("User: emergency", function () {
    it("Should revert if vault has not expired", async function () {
      const { vault, token, user, beneficiary } =
        await loadFixture(deployVaultFixture);
      await expect(
        vault
          .connect(user)
          .emergency(
            await token.getAddress(),
            await beneficiary.getAddress()
          )
      ).to.be.revertedWithCustomError(vault, "NotExpired");
    });

    it("Should allow user to emergency withdraw ERC20 after expiry", async function () {
      const { vault, token, user, beneficiary } =
        await loadFixture(deployVaultFixture);
      const tokenAddr = await token.getAddress();
      const beneficiaryAddr = await beneficiary.getAddress();

      // Fast forward past expiry
      const expireTime = await vault.getExpireTime();
      await time.increaseTo(expireTime + 1n);

      const vaultBalance = await token.balanceOf(await vault.getAddress());
      await expect(
        vault.connect(user).emergency(tokenAddr, beneficiaryAddr)
      )
        .to.emit(vault, "Emergency")
        .withArgs(tokenAddr, beneficiaryAddr, vaultBalance);

      expect(await token.balanceOf(beneficiaryAddr)).to.equal(vaultBalance);
      expect(await token.balanceOf(await vault.getAddress())).to.equal(0n);
    });

    it("Should revert if token address is zero", async function () {
      const { vault, user, beneficiary } =
        await loadFixture(deployVaultFixture);
      const expireTime = await vault.getExpireTime();
      await time.increaseTo(expireTime + 1n);

      await expect(
        vault
          .connect(user)
          .emergency(ZeroAddress, await beneficiary.getAddress())
      ).to.be.revertedWithCustomError(vault, "InvalidTokenAddress");
    });

    it("Should revert if beneficiary is zero address", async function () {
      const { vault, token, user } = await loadFixture(deployVaultFixture);
      const expireTime = await vault.getExpireTime();
      await time.increaseTo(expireTime + 1n);

      await expect(
        vault
          .connect(user)
          .emergency(await token.getAddress(), ZeroAddress)
      ).to.be.revertedWithCustomError(vault, "InvalidBeneficiary");
    });

    it("Should revert if balance is zero", async function () {
      const [owner2, user2, , beneficiary2]: Signer[] =
        await hre.ethers.getSigners();

      // Deploy a second ERC20 token (vault has no balance of this token)
      const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
      const token2 = await Token.connect(owner2).deploy("Other Token", "OT");
      await token2.waitForDeployment();

      // Deploy a fresh empty vault
      const ONVault = await hre.ethers.getContractFactory("ONVault");
      const emptyVault = await ONVault.deploy(
        await owner2.getAddress(),
        await user2.getAddress()
      );
      await emptyVault.waitForDeployment();

      const expireTime = await emptyVault.getExpireTime();
      await time.increaseTo(expireTime + 1n);

      await expect(
        emptyVault
          .connect(user2)
          .emergency(await token2.getAddress(), await beneficiary2.getAddress())
      ).to.be.revertedWithCustomError(emptyVault, "InvalidAmount");
    });

    it("Should revert if non-user calls emergency", async function () {
      const { vault, token, owner, beneficiary } =
        await loadFixture(deployVaultFixture);
      const expireTime = await vault.getExpireTime();
      await time.increaseTo(expireTime + 1n);

      await expect(
        vault
          .connect(owner)
          .emergency(
            await token.getAddress(),
            await beneficiary.getAddress()
          )
      ).to.be.revertedWithCustomError(vault, "InvalidUser");
    });
  });

  describe("Access control", function () {
    it("User cannot call setToken", async function () {
      const { vault, token, user } = await loadFixture(deployVaultFixture);
      await expect(
        vault.connect(user).setToken(await token.getAddress())
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("User cannot call transfer", async function () {
      const { vault, user, beneficiary } =
        await loadFixture(deployVaultFixture);
      await expect(
        vault
          .connect(user)
          .transfer(await beneficiary.getAddress(), parseEther("1"))
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("Owner cannot call extendExpireTime", async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);
      await expect(
        vault.connect(owner).extendExpireTime(ONE_MONTH)
      ).to.be.revertedWithCustomError(vault, "InvalidUser");
    });

    it("Owner cannot call emergency", async function () {
      const { vault, token, owner, beneficiary } =
        await loadFixture(deployVaultFixture);
      const expireTime = await vault.getExpireTime();
      await time.increaseTo(expireTime + 1n);

      await expect(
        vault
          .connect(owner)
          .emergency(
            await token.getAddress(),
            await beneficiary.getAddress()
          )
      ).to.be.revertedWithCustomError(vault, "InvalidUser");
    });

    it("Random account cannot call any privileged function", async function () {
      const { vault, token, other, beneficiary } =
        await loadFixture(deployVaultFixture);

      await expect(
        vault.connect(other).setToken(await token.getAddress())
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

      await expect(
        vault
          .connect(other)
          .transfer(await beneficiary.getAddress(), parseEther("1"))
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

      await expect(
        vault.connect(other).extendExpireTime(ONE_MONTH)
      ).to.be.revertedWithCustomError(vault, "InvalidUser");

      await expect(
        vault
          .connect(other)
          .emergency(
            await token.getAddress(),
            await beneficiary.getAddress()
          )
      ).to.be.revertedWithCustomError(vault, "InvalidUser");
    });
  });
});
