import { expect } from "chai";
import { ContractTransactionResponse, parseEther, Wallet } from "ethers";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { task } from "hardhat/config";

const MILESTONE_DURATION = 25n * 60n * 60n;

const VESTING_DURATION = MILESTONE_DURATION * 12n;

const AWAIT_CONFIRMATION = 2;

async function awaitTx(txReceipt: ContractTransactionResponse) {
  await txReceipt.wait(AWAIT_CONFIRMATION);
}

task("deploy:test", "Deploy test contracts").setAction(async (_args, hre) => {
  const deployer = Wallet.fromPhrase(process.env.WALLET_PASSPHRASE).connect(
    hre.ethers.provider
  );

  console.log("Deployer address:", deployer.address);

  if (hre.network.name !== "sepolia") {
    throw new Error("Wrong network, it must be sepolia");
  }

  /*
    if (hre.network.name === "local" || hre.network.name === "hardhat") {
      // Mine block on hardhat network
      setInterval(async () => {
        await hre.network.provider.send("evm_mine");
      }, 500);
      // Transfer token in hardhat
      const [account1] = await hre.ethers.getSigners();
      await account1.sendTransaction({
        to: await deployer.getAddress(),
        value: parseEther("100"),
      });
    }
*/
  const block = await hre.ethers.provider.getBlock("latest");

  if (!block) {
    throw new Error("Unknown block");
  }

  const TGE_TIME = BigInt(block.timestamp) + VESTING_DURATION;

  // Deploy a token
  const ONToken = await hre.ethers.getContractFactory("OrochiNetworkToken");
  const onToken = await ONToken.connect(deployer).deploy(
    "Orochi Network Token",
    "ON"
  );
  await onToken.waitForDeployment();

  console.log("Token address:", await onToken.getAddress());

  // Deploy ONVestingSub implementation
  const ONVestingSub = await hre.ethers.getContractFactory("ONVestingSub");
  const onVestingSubImpl = await ONVestingSub.connect(deployer).deploy();
  await onVestingSubImpl.waitForDeployment();

  console.log(
    "ONVestingSub implementation address:",
    await onVestingSubImpl.getAddress()
  );

  // Deploy ONVestingMain
  const ONVestingMain = await hre.ethers.getContractFactory("ONVestingMain");
  const onVestingMain = await ONVestingMain.connect(deployer).deploy(
    onToken,
    TGE_TIME,
    onVestingSubImpl
  );
  await onVestingMain.waitForDeployment();

  console.log("ONVestingMain address:", await onVestingMain.getAddress());

  expect(await onVestingMain.getTimeTGE()).to.eq(TGE_TIME);

  const tgeDate = new Date(Number(TGE_TIME) * 1000);
  console.log("TGE time UTC is:", tgeDate.toUTCString());
  console.log(
    "TGE time VN is:",
    tgeDate.toLocaleString("vi-VN", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Asia/Ho_Chi_Minh",
    })
  );

  // Transfer ownership of token to ONVestingMain
  await awaitTx(await onToken.transferOwnership(onVestingMain));

  // Mint all token to ONVestingMain
  await awaitTx(await onVestingMain.mint());

  expect(await onToken.balanceOf(onVestingMain)).to.eq(parseEther("600000000"));

  // Deploy ONAirdrop
  const ONAirdrop = await hre.ethers.getContractFactory("ONAirdrop");
  const onAirdrop = await ONAirdrop.connect(deployer).deploy(onVestingMain, [
    "0xba4e1dba84dad642fa04ab8edf4a441951d2b65f",
  ]);
  await onAirdrop.waitForDeployment();

  await awaitTx(
    await onVestingMain.transfer(onAirdrop, parseEther("14000000"))
  );

  expect(await onToken.balanceOf(onAirdrop)).to.eq(parseEther("14000000"));

  console.table([
    {
      contractName: "Deployer",
      address: await deployer.getAddress(),
    },
    {
      contractName: "ON Token",
      address: await onToken.getAddress(),
    },
    {
      contractName: "ON Vesting Main",
      address: await onVestingMain.getAddress(),
    },
    {
      contractName: "ON Vesting Sub",
      address: await onVestingSubImpl.getAddress(),
    },
    {
      contractName: "ON Airdrop",
      address: await onAirdrop.getAddress(),
    },
  ]);

  const fileContent = {
    VITE_ON_TOKEN_BNB_ADDRESS: "0x0e4f6209ed984b21edea43ace6e09559ed051d48",
    VITE_BNB_SCAN_URL: "https://bscscan.com",
    VITE_ON_TOKEN_ADDRESS: await onToken.getAddress(),
    VITE_ON_VESTING_MAIN_ADDRESS: await onVestingMain.getAddress(),
    VITE_ON_AIRDROP_ADDRESS: await onAirdrop.getAddress(),
  };

  const addressTest = [
    "0x10a0031781971bd37504354bba49299885ad5cd4",
    "0xd855557ae72b096fed544403273d7e33a89b4666",
    "0xccac07fbabf37be1b3c11bc6e9f2b61e28d451d1",
    "0x274f89bc4b327667e3ed584ce8ba78c151b35df7",
    "0x2f26f55c76352cac576a936081c31d375556ea56",
    "0xbf4274bce0c6eb25c6c24d07fd82f63904688169",
    "0x26c89c7a0b40e318c74b21752cddc9bd7d6415a8",
    "0x327c97a13cd025009cdef8ed00bcf1a861250db4",
    "0x249316efc45874049b2b8d912a419f01294474fc",
    "0xfa3c18b6a340c78c61f30040a72f3493f92adfc1",
    "0xd7b9c352e3c3d866744e3053491dd4cb428f56be",
    "0xeb0bc21f42709cb58f676316ff75a76790d2a820",
    "0xe8b8e551fccf5a4796cffb4dba1a5fbaec878b5e",
    "0x778346778c2d1278e918fbefebabf987b27c44ff",
    "0xcf0e9a0a6fb983043f14b74aeb1e95f10315cc4b",
  ];

  for (let i = 0; i < addressTest.length; i += 1) {
    const amount = (Math.round(Math.random() * 10 + 1) * 1000000).toString();
    console.log("Processing:", addressTest[i], amount);

    await awaitTx(
      await onVestingMain.addVestingTerm({
        beneficiary: addressTest[i],
        unlockedAtTGE: parseEther("10"),
        milestoneDuration: MILESTONE_DURATION,
        cliff: MILESTONE_DURATION,
        vestingDuration: VESTING_DURATION,
        total: parseEther(amount),
      })
    );
  }

  if (!existsSync("./out")) {
    mkdirSync("./out");
    writeFileSync(
      "./out/address.txt",
      Object.entries(fileContent)
        .map((e) => e.join("="))
        .join("\n")
    );
  }
});
