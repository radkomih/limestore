// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

error AuthorizationError(string message);
error ProductMissingError(string message);
error ProductQuantityError(string message);
error ProductDuplicationError(string message);
error OrderError(string message);
error ReturnError(string message);

contract Ownable {
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only allowed for the owner.");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
}

contract Store is Ownable {

    /// @dev fast lookup if a product is added to the store
    mapping (uint => bool) private productsCatalog;

    /// @dev fast lookup of which products are available to purchase
    uint[] private availableProducts;

    /// @dev keeps track of the indexes of each product id
    mapping (uint => int) private productsIndexes;

    /// @dev keeps track of all products quantities
    mapping (uint => uint) private productsQuantities;

    /// @dev fast lookup of the customers that bought a specific product
    mapping (uint => address[]) private productsOrders;

    /// @dev fast lookup if a customer has bought the product only once
    mapping (address => mapping (uint => bool)) private customersOrders;

    /// @dev keeps track of the orders timestamps (since it is not allowed for customer to buy specific product more than once)
    mapping (address => mapping (uint => uint)) private customersOrdersTimestamps;

    modifier onlyCustomer() {
        if (msg.sender == owner) {
            revert AuthorizationError("Not allowed for the owner.");
        }
        _;
    }

    modifier ifProductExists(uint productId) {
        if (!productsCatalog[productId]) {
            revert ProductMissingError("");
        }
        _;
    }

    /// @notice The owner of the store should be able to add new products and the quantity of them.
    /// @notice The owner should not be able to add the same product twice, just quantity.
    /// @dev if we don't expect explicit error to be thrown, single mapping of product id to quantity is sufficient to prevent duplicate entries.
    function addProduct(uint productId, uint quantity) external onlyOwner {
        if (productsCatalog[productId]) {
            revert ProductDuplicationError("It has already been added.");
        }

        if (quantity == 0) {
            revert ProductQuantityError("Should be greater than zero.");
        }

        productsCatalog[productId] = true;
        _makeAvailable(productId);
        productsQuantities[productId] = quantity;
    }

    /// @notice The owner should be able to addjust the quantity.
    function updateQuantity(uint productId, uint quantity) external onlyOwner ifProductExists(productId) {
        if (productsQuantities[productId] == 0 && quantity > 0) {
            _makeAvailable(productId);
        }

        if (productsQuantities[productId] > 0 && quantity == 0) {
            _makeUnavailable(productId);
        }
        
        productsQuantities[productId] = quantity;
    }

    /// @notice Customers should be able to buy products by their id.
    /// @notice A customer cannot buy the same product more than one time.
    /// @notice The customers should not be able to buy a product more times than the quantity in the store unless a product is returned or added by the owner.
    /// @dev the actual payment is not part of the requirements.
    function buyProduct(uint productId) external onlyCustomer ifProductExists(productId) {        
        if (productsQuantities[productId] <= 0) {
            revert ProductQuantityError("It is sold out.");
        }

        address customer = msg.sender;
        if (customersOrders[customer][productId]) {
            revert OrderError("The customer has already bought the same product.");
        }

        customersOrders[customer][productId] = true;
        productsQuantities[productId] -= 1;

        if (productsQuantities[productId] == 0) {
             _makeUnavailable(productId);
        }

        customersOrdersTimestamps[customer][productId] = block.number;
        productsOrders[productId].push(customer);
    }

    /// @notice Customers should be able to return products if they are not satisfied (within a certain period in blocktime: 100 blocks).
    /// @dev returning it does not change the fact that the customer has purchased the product
    function returnProduct(uint productId) external onlyCustomer {
        address customer = msg.sender;
        if (!customersOrders[customer][productId]) {
            revert ReturnError("The customer hasn't bought such product.");
        }

        uint boughtAt = customersOrdersTimestamps[customer][productId];
        if (block.number - boughtAt > 100) {
            revert ReturnError("The deadline is not met.");
        }

        if (productsQuantities[productId] == 0) {
            _makeAvailable(productId);
            customersOrders[customer][productId] = false;
        }

        productsQuantities[productId] += 1;
    }

    /// @notice Customers should be able to see the available products.
    function getAvailableProducts() external view onlyCustomer returns (uint[] memory) {
        return availableProducts;
    }

    /// @notice Everyone should be able to see the addresses of all customers that have ever bought a given product.
    function getCustomersByProduct(uint productId) external view returns (address[] memory) {
        return productsOrders[productId];
    }

    function _makeAvailable(uint productId) private {
        availableProducts.push(productId);
        int indexOfAddedId = int(availableProducts.length - 1);
        productsIndexes[productId] = indexOfAddedId;
    }

    function _makeUnavailable(uint productId) private {
        int indexOfRemovedId = int(productsIndexes[productId]);
        uint lastProductId = availableProducts[availableProducts.length - 1];
        availableProducts[uint(indexOfRemovedId)] = lastProductId;
        productsIndexes[lastProductId] = indexOfRemovedId;
        productsIndexes[productId] = -1;
        availableProducts.pop();
    }
}