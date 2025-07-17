import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { parseEther, Signer, ZeroAddress } from "ethers";
import hre from "hardhat";

describe("OrochiNetworkToken", function () {
  async function deployTokenFixture() {
    const [owner, addr1, addr2]: Signer[] = await hre.ethers.getSigners();
    const Token = await hre.ethers.getContractFactory("OrochiNetworkToken");
    const token = await Token.deploy("Orochi Token", "ON");
    return { token, owner, addr1, addr2 };
  }

  it("Should have the correct name and symbol", async function () {
    const { token } = await loadFixture(deployTokenFixture);
    expect(await token.name()).to.equal("Orochi Token");
    expect(await token.symbol()).to.equal("ON");
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

  it("Non-owner cannot mint tokens", async function () {
    const { token, addr1 } = await loadFixture(deployTokenFixture);
    await expect(token.connect(addr1).mint()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Total supply increases with mint", async function () {
    const { token, owner } = await loadFixture(deployTokenFixture);
    await token.connect(owner).mint();
    expect(await token.totalSupply()).to.equal(parseEther("700000000"));
  });
});
