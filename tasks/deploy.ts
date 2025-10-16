import { expect } from "chai";
import { ContractTransactionResponse, parseEther } from "ethers";
import { task } from "hardhat/config";
import { getKmsWallet } from "../scripts/wallet";

const ONE_DAY = 86400n;

const ONE_MONTH = ONE_DAY * 30n;

const TWELVE_MONTH = ONE_MONTH * 12n;

const AWAIT_CONFIRMATION = 5;

async function awaitTx(txReceipt: ContractTransactionResponse) {
  await txReceipt.wait(AWAIT_CONFIRMATION);
}

task("deploy", "Deploy the contracts").setAction(async (_args, hre) => {
  const deployer = (await getKmsWallet()).connect(hre.ethers.provider);

  expect((await deployer.getAddress()).toLowerCase()).to.eq(
    process.env.KMS_WALLET_ADDRESS.toLowerCase()
  );

  console.log("Deployer address:", process.env.KMS_WALLET_ADDRESS);

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

  // Deploy a token
  const ONToken = await hre.ethers.getContractFactory("OrochiNetworkToken");
  const onToken = await ONToken.connect(deployer).deploy(
    "Orochi Network Token",
    "ON"
  );
  await onToken.waitForDeployment();

  console.log("Token address:", await onToken.getAddress());

  // Get block timestamp
  const block = await hre.ethers.provider.getBlock("latest");
  if (!block) {
    throw new Error("Invalid block timestamp");
  }
  const blockTimestamp = BigInt(block.timestamp);
  const timeTGE = blockTimestamp + 86400n; // Set TGE is 1 day ahead

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
    timeTGE,
    onVestingSubImpl
  );
  await onVestingMain.waitForDeployment();

  console.log("ONVestingMain address:", await onVestingMain.getAddress());

  expect(await onVestingMain.getTimeTGE()).to.eq(timeTGE);

  const tgeDate = new Date(Number(timeTGE) * 1000);
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

  expect(await onToken.balanceOf(onVestingMain)).to.eq(parseEther("700000000"));

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
  ]);

  if (hre.network.name === "sepolia") {
    console.log("Create test data for Sepolia");
    const testAddresses = [
      "0x10A0031781971bd37504354BBa49299885aD5cd4",
      "0xD855557Ae72b096fED544403273D7E33A89b4666",
      "0xccac07fBaBF37BE1B3C11Bc6e9f2b61E28D451D1",
      "0x274F89bc4b327667e3eD584CE8BA78c151b35DF7",
      "0x2F26f55C76352cac576A936081C31D375556Ea56",
      "0xBF4274bcE0c6Eb25C6C24D07FD82F63904688169",
      "0x26c89c7A0b40E318C74B21752CdDC9bd7d6415A8",
      "0x327C97A13cD025009CdeF8ED00BCf1A861250DB4",
      "0x249316efc45874049B2b8d912a419F01294474Fc",
    ];

    for (let i = 0; i < testAddresses.length; i += 1) {
      const txNative = await deployer.sendTransaction({
        to: testAddresses[i],
        value: parseEther("0.1"),
      });
      await txNative.wait(1);
      await awaitTx(
        await onVestingMain.addVestingTerm({
          beneficiary: testAddresses[i],
          unlockedAtTGE: 0,
          milestoneDuration: ONE_MONTH,
          cliff: ONE_MONTH,
          vestingDuration: TWELVE_MONTH,
          total: parseEther("1000000"),
        })
      );
    }
  }
});
