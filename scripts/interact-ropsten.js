const hre = require("hardhat");
const Store = require("../artifacts/contracts/Store.sol/Store.json");

(async () => {
  const provider = new hre.ethers.providers.InfuraProvider(
    "ropsten",
    process.env.ROPSTEN_INFURA_API_KEY
  );

  const wallet1 = new hre.ethers.Wallet(process.env.PRIVATE_KEY1, provider);
  const wallet2 = new hre.ethers.Wallet(process.env.PRIVATE_KEY2, provider);

  const balance1 = await wallet1.getBalance();
  const balance2 = await wallet2.getBalance();
  console.log(`Owner balance: ${hre.ethers.utils.formatEther(balance1, 18)}`);
  console.log(
    `Customer balance: ${hre.ethers.utils.formatEther(balance2, 18)}`
  );

  const storeContract = new hre.ethers.Contract(
    "0x495C492471d38EE9E8486725360D5A0C0eb45C06",
    Store.abi,
    wallet1
  );

  const addProductTx = await storeContract
    .connect(wallet1)
    .addProduct(111, 2, 1); // .addProduct(222, 1, 1);
  const addProductTxReceipt = await addProductTx.wait();
  if (addProductTxReceipt.status === 1) {
    console.log("Added new product");
  }

  const buyProductTx = await storeContract.connect(wallet2).buyProduct(222, {
    value: hre.ethers.utils.parseEther("1"),
  });
  const buyProductTxReceipt = await buyProductTx.wait();
  if (buyProductTxReceipt.status === 1) {
    console.log("Purchased product");
  }

  const returnProductTx = await storeContract
    .connect(wallet2)
    .returnProduct(222);

  const returnProductTxReceipt = await returnProductTx.wait();
  if (returnProductTxReceipt.status === 1) {
    console.log("Returned product");
  }

  const productIds = await storeContract
    .connect(wallet2)
    .getAvailableProducts();
  console.log(`Available products: ${productIds}`);
})();
