import { parseEther } from "ethers";
import { task } from "hardhat/config";
import { getKmsWallet } from "../scripts/wallet";

const ONE_HOUR = 60n * 60n;
const CONFIRMATION = 2;

task(
  "deploy-customized",
  "Deploy minimal ONCustomizedVesting + a funded standalone ONVestingSub"
).setAction(async (_args, hre) => {
  const beneficiary = "0x3FB52F41bd66ec0b59419F95f2612341262618ee";
  const [account1] = await hre.ethers.getSigners();

  const deployer = (await getKmsWallet()).connect(hre.ethers.provider);

  if (hre.network.name === "local" || hre.network.name === "hardhat") {
    // Mine block on hardhat network
    setInterval(async () => {
      await hre.network.provider.send("evm_mine");
    }, 500);
    await account1.sendTransaction({
      to: await deployer.getAddress(),
      value: parseEther("100"),
    });
  }

  // Get block timestamp
  const block = await hre.ethers.provider.getBlock("latest");
  if (!block) {
    throw new Error("Invalid block timestamp");
  }
  const timeTGE = BigInt(block.timestamp) + ONE_HOUR;

  // Deploy the minimal customized vesting main (ON token is hardcoded inside).
  const ONCustomizedVesting = await hre.ethers.getContractFactory(
    "ONCustomizedVesting"
  );
  const onCustomizedVesting = await ONCustomizedVesting.connect(deployer).deploy(
    timeTGE
  );
  await onCustomizedVesting.waitForDeployment();

  // Deploy a standalone ONVestingSub and initialise it against the main.
  const ONVestingSub = await hre.ethers.getContractFactory("ONVestingSub");
  const sub = await ONVestingSub.connect(deployer).deploy();
  await sub.waitForDeployment();

  const vestingTerm = {
    beneficiary,
    unlockedAtTGE: parseEther("1000"),
    milestoneDuration: ONE_HOUR,
    cliff: ONE_HOUR * 3n,
    vestingDuration: ONE_HOUR * 12n,
    total: parseEther("1000000"),
  };
  await (
    await sub.connect(deployer).init(onCustomizedVesting, vestingTerm)
  ).wait(CONFIRMATION);

  // Fund the sub by transferring the ON token directly to it.
  const token = await hre.ethers.getContractAt(
    "OrochiNetworkToken",
    await onCustomizedVesting.getTokenAddress()
  );
  await (
    await token.connect(deployer).transfer(sub, vestingTerm.total)
  ).wait(CONFIRMATION);

  console.table([
    {
      contractName: "Deployer",
      address: await deployer.getAddress(),
    },
    {
      contractName: "Beneficiary",
      address: beneficiary,
    },
    {
      contractName: "ON Token (fixed)",
      address: await onCustomizedVesting.getTokenAddress(),
    },
    {
      contractName: "ON Customized Vesting",
      address: await onCustomizedVesting.getAddress(),
    },
    {
      contractName: "ON Vesting Sub",
      address: await sub.getAddress(),
    },
  ]);
});
