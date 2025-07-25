import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { parseEther, Signer, ZeroAddress } from "ethers";
import hre from "hardhat";

describe("OrochiNetworkToken", function () {
  async function deployTokenFixture() {
    const [owner, addr1, addr2]: Signer[] = await hre.ethers.getSigners();
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi Token", "ON");
    await token.waitForDeployment();
    return { Token, token, owner, addr1, addr2 };
  }

  it("Should have the correct name and symbol", async function () {
    const { Token } = await loadFixture(deployTokenFixture);
    const token1 = await Token.deploy("Orochi Token", "ON");
    await token1.waitForDeployment();
    expect(await token1.name()).to.equal("Orochi Token");
    expect(await token1.symbol()).to.equal("ON");
  });

  it("Owner can mint tokens", async function () {
    const { token, owner } = await loadFixture(deployTokenFixture);
    await expect(token.connect(owner).mint())
      .to.emit(token, "Transfer")
      .withArgs(ZeroAddress, await owner.getAddress(), parseEther("700000000"));
    expect(await token.balanceOf(await owner.getAddress())).to.equal(
      parseEther("700000000")
    );
  });

  it("Should not able to mint twice", async function () {
    const { token, owner } = await loadFixture(deployTokenFixture);
    await expect(token.connect(owner).mint())
      .to.emit(token, "Transfer")
      .withArgs(ZeroAddress, await owner.getAddress(), parseEther("700000000"));
    expect(await token.balanceOf(await owner.getAddress())).to.equal(
      parseEther("700000000")
    );

    await expect(token.connect(owner).mint()).to.revertedWith(
      "ON: Max supply is minted"
    );
  });

  it("Non-owner cannot mint tokens", async function () {
    const { token, addr1 } = await loadFixture(deployTokenFixture);
    await expect(token.connect(addr1).mint()).to.be.revertedWithCustomError(
      token, 'OwnableUnauthorizedAccount'
    );
  });

  it("Total supply increases with mint", async function () {
    const { token, owner } = await loadFixture(deployTokenFixture);
    await token.connect(owner).mint();
    expect(await token.totalSupply()).to.equal(parseEther("700000000"));
  });
});
