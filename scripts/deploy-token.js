const hre = require("hardhat");

async function main() {
  // await hre.run('compile');

  const provider = new hre.ethers.providers.JsonRpcProvider("http://localhost:8545");

  const wallet1 = new hre.ethers.Wallet(process.env.PRIVATE_KEY1, provider);
  const wallet2 = new hre.ethers.Wallet(process.env.PRIVATE_KEY2, provider);

  console.log(`Deployer address: ${await wallet1.getAddress()}`);
  console.log(`Receiver address: ${await wallet2.getAddress()}`);

  const LimeToken = await hre.ethers.getContractFactory("LimeToken", wallet1);
  const token = await LimeToken.deploy();
  await token.deployed();
  console.log("LimeToken address:", token.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
