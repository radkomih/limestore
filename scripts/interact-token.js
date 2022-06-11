require("dotenv").config();

const hre = require("hardhat");
const LimeToken = require("../artifacts/contracts/LimeToken.sol/LimeToken.json");

async function main() {
  // await hre.run("compile");

  // const provider = new hre.ethers.providers.InfuraProvider("ropsten", process.env.ROPSTEN_INFURA_API_KEY);
  const provider = new hre.ethers.providers.JsonRpcProvider(
    "http://localhost:8545"
  );

  const wallet1 = new hre.ethers.Wallet(process.env.PRIVATE_KEY1, provider);
  const wallet2 = new hre.ethers.Wallet(process.env.PRIVATE_KEY2, provider);
  const wallet3 = new hre.ethers.Wallet(process.env.PRIVATE_KEY3, provider);

  console.log(`Deployer address: ${await wallet1.getAddress()}`);
  console.log(`Customer1 address: ${await wallet2.getAddress()}`);
  console.log(`Customer2 address: ${await wallet3.getAddress()}`);
  const [deployer, customer1, customer2] = await hre.ethers.getSigners();

  // const LimeToken = await hre.ethers.getContractFactory("LimeToken", wallet1);
  // const token = await LimeToken.deploy();
  // await token.deployed();
  // console.log("LimeToken address:", token.address);

  const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const token = new hre.ethers.Contract(
    CONTRACT_ADDRESS,
    LimeToken.abi,
    wallet1
  );

  const decimals = await token.connect(wallet1).decimals();
  const symbol = await token.connect(wallet1).symbol();

  const amount1 = hre.ethers.utils.parseUnits("4", decimals);
  const mintTx = await token.connect(wallet1).mint(deployer.address, amount1);
  const mintTxReceipt = await mintTx.wait();
  if (mintTxReceipt.status !== 1) {
    console.log("Mint Tx failed");
  }

  const amount2 = hre.ethers.utils.parseUnits("3", decimals);
  const transferTx = await token
    .connect(wallet1)
    .transfer(customer1.address, amount2);
  const transferTxReceipt = await transferTx.wait();
  if (transferTxReceipt.status !== 1) {
    console.log("Transfer Tx failed");
  }

  const deployerBalance = await token
    .connect(wallet1)
    .balanceOf(deployer.address);
  console.log(`Deployer balance: ${(deployerBalance / 10 ** decimals).toString()} ${symbol}`);

  const customer1Balance = await token
    .connect(wallet1)
    .balanceOf(customer1.address);
  console.log(`Customer1 balance: ${(customer1Balance / 10 ** decimals).toString()} ${symbol}`);

  const amountToBurn = hre.ethers.utils.parseUnits("0.5", decimals);
  const mintTx3 = await token.connect(wallet1).burn(amountToBurn);
  const mintTx3Receipt = await mintTx3.wait();
  if (mintTx3Receipt.status !== 1) {
    console.log("Burn Tx failed");
  }
  const leftBalance = await token.connect(wallet1).balanceOf(deployer.address);
  console.log(`Deployer balance: ${(leftBalance / 10 ** decimals).toString()} ${symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
