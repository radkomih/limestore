const { assertRevertError } = require("./exceptionExpectationHelpers.js")
const { advanceTime, advanceBlock, advanceTimeAndBlock } = require("./timeTravelHelper.js")
const Store = artifacts.require('Store')

contract('Store', async (accounts) => {
  let storeInstance
  let owner = accounts[0]
  let customer1 = accounts[1]
  let customer2 = accounts[2]

  beforeEach(async () => {
    storeInstance = await Store.new()
  })

  it('adds new product (owner)', async() => {
    await storeInstance.addProduct(111, 2, { from: owner })
    await storeInstance.addProduct(222, 2, { from: owner })

    let productIds = await storeInstance.getAvailableProducts.call({ from: customer1 })

    assert.equal(2, productIds.length)
    assert.equal(111, productIds[0].toNumber())
    assert.equal(222, productIds[1].toNumber())
  })

  it('fails to add same product twice', async() => {
    await storeInstance.addProduct(333, 2, { from: owner })
    
    await assertRevertError(
      storeInstance.addProduct(333, 2, { from: owner })
    )
  })

  it('fails to add product with zero quantity', async() => {
    await assertRevertError(
      storeInstance.addProduct(444, 0, { from: owner })
    )
  })

  it('fails to add product (customer)', async() => {
    await assertRevertError(
      storeInstance.addProduct(555, 1, { from: customer1 })
    )
  })

  it('updates the quantity (owner)', async() => {
    await storeInstance.addProduct(666, 1, { from: owner })
    await storeInstance.updateQuantity(666, 0, { from: owner })

    let ids = await storeInstance.getAvailableProducts.call({ from: customer1 })

    assert.equal(0, ids.length)
  })

  it('fails to update the quantity of non existing product', async() => {
    await assertRevertError(
      storeInstance.updateQuantity(777, 1, { from: owner })
    )
  })

  it('fails to update the quantity (customer)', async() => {
    await storeInstance.addProduct(888, 1, { from: owner })

    await assertRevertError(
      storeInstance.updateQuantity(888, 0, { from: customer1 })
    )
  })

  it('buys a product (customer)', async() => {
    await storeInstance.addProduct(999, 2, { from: owner })

    await storeInstance.buyProduct(999, { from: customer1 })
    await storeInstance.buyProduct(999, { from: customer2 })

    let productIds = await storeInstance.getAvailableProducts.call({ from: customer1 })

    assert.equal(0, productIds.length)
  })

  it('fails to buy a non existing product (customer)', async() => {
    await assertRevertError(
      storeInstance.buyProduct(123, { from: customer2 })
    )
  })

  it('fails to buy a sold out product (customer)', async() => {
    await assertRevertError(
      storeInstance.buyProduct(123, { from: customer2 })
    )
  })

  it('fails to buy the same product twice (customer)', async() => {
    await storeInstance.addProduct(101, 2, { from: owner })
    await storeInstance.buyProduct(101, { from: customer1 })

    await assertRevertError(
      storeInstance.buyProduct(101, { from: customer1 })
    )

    await storeInstance.buyProduct(101, { from: customer2 })

    let productIds = await storeInstance.getAvailableProducts.call({ from: customer1 })

    assert.equal(0, productIds.length)
  })

  it('fails to buy a product (owner)', async() => {
    storeInstance.addProduct(202, 1, { from: owner })

    await assertRevertError(
      storeInstance.buyProduct(202, { from: owner })
    )
  })

  it('returns previously bought product (customer)', async() => {
    await storeInstance.addProduct(303, 1, { from: owner })
    await storeInstance.buyProduct(303, { from: customer1 })
    await storeInstance.returnProduct(303, { from: customer1 })

    let productIds = await storeInstance.getAvailableProducts.call({ from: customer1 })

    assert.equal(1, productIds.length)
  })

  it('fails to return non existing product (customer)', async() => {
    await assertRevertError(
      storeInstance.returnProduct(404, { from: customer1 })
    )
  })

  it('fails to return previously bought product in the eligable timeframe (customer)', async() => {
    await storeInstance.addProduct(505, 1, { from: owner })
    await storeInstance.buyProduct(505, { from: customer1 })
    
    // mine additional 100 blocks
    for (let i = 1; i <= 100; i++) {
      await advanceBlock()
    }

    await assertRevertError(
      storeInstance.returnProduct(505, { from: customer1 })
    )

    let productIds = await storeInstance.getAvailableProducts.call({ from: customer1 })

    assert.equal(0, productIds.length)
  })
})