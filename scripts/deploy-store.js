require("dotenv").config();

const hre = require("hardhat");

async function main() {
  // await hre.run('compile');

  const provider = new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");

  const wallet1 = new hre.ethers.Wallet(process.env.PRIVATE_KEY1, provider);
  const wallet2 = new hre.ethers.Wallet(process.env.PRIVATE_KEY2, provider);

  const Store = await hre.ethers.getContractFactory("Store", wallet1);
  const store = await Store.deploy("0x5FbDB2315678afecb367f032d93F642f64180aa3");
  await store.deployed();
  console.log("Store deployed to:", store.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
