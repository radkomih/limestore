const { expect } = require("chai");
const { ethers, network } = require("hardhat");

async function mineBlocks(blockNumber) {
  while (blockNumber > 0) {
    blockNumber--;
    await network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }
}

describe("Store", function () {
  let store;
  let owner;
  let customer1;
  let customer2;
  let customer3;

  beforeEach(async () => {
    [owner, customer1, customer2, customer3] = await ethers.getSigners();
    const Store = await ethers.getContractFactory("Store", owner);
    store = await Store.deploy();
    await store.deployed();
  });

  it("adds new products (owner)", async function () {
    await expect(store.addProduct(111, 2, 1))
      .to.emit(store, "ProductAdded")
      .withArgs(111, 2, 1);

    await expect(store.addProduct(222, 5, 3))
      .to.emit(store, "ProductAdded")
      .withArgs(222, 5, 3);
  });

  it("fails to add the same product twice (owner)", async function () {
    await store.addProduct(333, 2, 3);

    await expect(store.addProduct(333, 2, 3)).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'ProductDuplicationError(\"It has already been added.\")'"
    );
  });

  it("fails to add a product with zero quantity (owner)", async function () {
    await expect(store.addProduct(444, 0, 3)).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'ProductQuantityError(\"Should be greater than zero.\")'"
    );
  });

  it("fails to add a product (customer)", async function () {
    await expect(
      store.connect(customer1).addProduct(555, 1, 3)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'"
    );
  });

  it("updates the quantity (owner)", async function () {
    await store.addProduct(666, 1, 3);

    await expect(store.updateQuantity(666, 0))
      .to.emit(store, "QuantityUpdated")
      .withArgs(666, 0);
  });

  it("fails to update the quantity of non existing product (owner)", async function () {
    await expect(store.updateQuantity(777, 1)).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'ProductMissingError(\"\")'"
    );
  });

  it("fails to update the quantity (customer)", async function () {
    await store.addProduct(888, 1, 3);

    await expect(
      store.connect(customer1).updateQuantity(888, 0)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'"
    );
  });

  it("buys a product (customer)", async function () {
    await store.addProduct(999, 2, 3);

    await expect(
      store.connect(customer1).buyProduct(999, {
        value: ethers.utils.parseEther("3"),
      })
    )
      .to.emit(store, "OrderPlaced")
      .withArgs(999);
  });

  it("fails to buy a non existing product (customer)", async function () {
    await expect(
      store.connect(customer2).buyProduct(123, {
        value: ethers.utils.parseEther("3"),
      })
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'ProductMissingError(\"\")'"
    );
  });

  it("fails to buy a sold out product (customer)", async function () {
    await expect(
      store.connect(customer2).buyProduct(123, {
        value: ethers.utils.parseEther("3"),
      })
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'ProductMissingError(\"\")'"
    );
  });

  it("fails to buy the same product twice (customer)", async function () {
    await store.addProduct(101, 2, 3);
    await store.connect(customer1).buyProduct(101, {
      value: ethers.utils.parseEther("3"),
    });

    await expect(
      store.connect(customer1).buyProduct(101, {
        value: ethers.utils.parseEther("3"),
      })
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'OrderError(\"The customer has already bought the same product.\")'"
    );

    await expect(
      store.connect(customer2).buyProduct(101, {
        value: ethers.utils.parseEther("3"),
      })
    )
      .to.emit(store, "OrderPlaced")
      .withArgs(101);
  });

  it("fails to buy a product (owner)", async function () {
    await store.addProduct(202, 1, 3);

    await expect(
      store.buyProduct(202, { value: ethers.utils.parseEther("3") })
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'AuthorizationError(\"Not allowed for the owner.\")'"
    );
  });

  it("returns previously bought product (customer)", async function () {
    await store.addProduct(303, 1, 3);
    await store.connect(customer2).buyProduct(303, {
      value: ethers.utils.parseEther("3"),
    });

    await expect(store.connect(customer2).returnProduct(303))
      .to.emit(store, "ReturnInitiated")
      .withArgs(303);
  });

  it("fails to return non existing product (customer)", async function () {
    await expect(
      store.connect(customer1).returnProduct(404)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'ReturnError(\"The customer hasn't bought such product.\")'"
    );
  });

  it("fails to return previously bought product in the eligable timeframe (customer)", async function () {
    await store.addProduct(505, 1, 3);
    await store.connect(customer2).buyProduct(505, {
      value: ethers.utils.parseEther("3"),
    });

    // after additional 100 blocks
    await mineBlocks(100);

    await expect(
      store.connect(customer2).returnProduct(505)
    ).to.be.revertedWith(
      "VM Exception while processing transaction: reverted with custom error 'ReturnError(\"The deadline is not met.\")'"
    );
  });

  it("returns only the available products (customer)", async function () {
    await store.addProduct(606, 1, 3);
    await store.addProduct(707, 1, 3);
    await store.addProduct(808, 1, 3);
    await store.addProduct(909, 1, 3);
    await store.updateQuantity(909, 0);

    await store.connect(customer1).buyProduct(606, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer2).buyProduct(808, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer1).returnProduct(606);

    const productIds = await store.connect(customer2).getAvailableProducts();

    expect(productIds.length).to.equal(2);
    expect(productIds[0]).to.equal(707);
    expect(productIds[1]).to.equal(606);
  });

  it("returns only the customers that purchased a specific product (customer)", async function () {
    await store.addProduct(102, 2, 3);
    await store.addProduct(201, 2, 3);
    await store.addProduct(301, 2, 3);
    await store.connect(customer1).buyProduct(102, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer1).buyProduct(201, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer2).buyProduct(102, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer3).buyProduct(201, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer3).buyProduct(301, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer1).returnProduct(201);
    await store.connect(customer1).buyProduct(201, {
      value: ethers.utils.parseEther("3"),
    });

    const customers = await store.connect(customer1).getCustomersByProduct(201);

    expect(customers.length).to.equal(2);
    expect(customers[0]).to.equal(customer1.address);
    expect(customers[1]).to.equal(customer3.address);
  });

  it("returns a product and buy it again (customer)", async function () {
    await store.addProduct(123, 2, 3);

    await store.connect(customer1).buyProduct(123, {
      value: ethers.utils.parseEther("3"),
    });

    await store.connect(customer1).returnProduct(123);

    await expect(
      store.connect(customer1).buyProduct(123, {
        value: ethers.utils.parseEther("3"),
      })
    ).to.not.be.revertedWith();
  });

  it("returns the total balance (owner)", async function () {
    await store.addProduct(987, 1, 1);
    await store.addProduct(654, 1, 1);
    await store.addProduct(321, 1, 3);

    await store.connect(customer1).buyProduct(987, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer2).buyProduct(654, {
      value: ethers.utils.parseEther("5"),
    });
    await store.connect(customer3).buyProduct(321, {
      value: ethers.utils.parseEther("3"),
    });
    await store.connect(customer1).returnProduct(987);

    expect(await store.getTotalBallance()).to.equal(
      ethers.utils.parseEther("4")
    );
  });
});
