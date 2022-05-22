const hre = require("hardhat");
const ethers = hre.ethers;

async function deployToRopsten(_privateKey) {
  await hre.run("compile");

  const provider = new hre.ethers.providers.InfuraProvider(
    "ropsten",
    "40c2813049e44ec79cb4d7e0d18de173"
  );
  const wallet = new hre.ethers.Wallet(_privateKey, provider);
  console.log(`Account Balance: ${await wallet.getBalance()}`);

  const [deployer] = await ethers.getSigners();
  console.log(`From: ${deployer.address}`);

  const Store = await ethers.getContractFactory("Store", wallet);
  const StoreContract = await Store.deploy();
  await StoreContract.deployed();

  console.log(`Deployed Contract: ${StoreContract.address}`);
}

module.exports = deployToRopsten;

// 0x4a685D9E75FF5fBcF5ba9Da0A7051CE5cb56451b
// 0x6CA84dD30B5D55146D5d383b9c1a21E186180Ff9
// 0x495C492471d38EE9E8486725360D5A0C0eb45C06
// 0x052e380BE4f57a64573dFcC801a467119F43c8B9
// 0xb0f22baB48D4Db3A06f6b3f8ad9eA1bf1518D292