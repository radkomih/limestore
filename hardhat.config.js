require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("deploy-ropsten", "Deploy to Ropsten test network")
  .addParam("privateKey", "Please provide a private key")
  .setAction(async ({ privateKey }) => {
    const deployToRopsten = require("./scripts/deploy-ropsten");
    await deployToRopsten(privateKey);
  });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.5",
  networks: {
    ropsten: {
      url: `${process.env.ROPSTEN_INFURA_URL}${process.env.ROPSTEN_INFURA_APIKEY}`,
      accounts: [`${process.env.PRIVATE_KEY1}`],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ROPSTEN_ETHERSCAN_API_KEY,
  },
};
