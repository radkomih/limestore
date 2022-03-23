// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

error AuthorizationError(string message);
error ProductMissingError(string message);
error ProductQuantityError(string message);
error ProductDuplicationError(string message);
error OrderError(string message);
error ReturnError(string message);
error PaymentError(string message);

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
    mapping (uint => uint) public productsQuantities;

    /// @dev keeps track of all products prices
    mapping (uint => uint) public productsPrices;

    /// @dev fast lookup of the customers that bought a specific product
    mapping (uint => address[]) private productsOrders;

    /// @dev fast lookup if a customer has bought the product only once
    mapping (address => mapping (uint => bool)) private customersOrders;

    /// @dev keeps track of the orders timestamps (since it is not allowed for customer to buy specific product more than once)
    mapping (address => mapping (uint => uint)) private customersOrdersTimestamps;
    
    /// @dev keeps track of totals by customer, product and price
    mapping (address => mapping (uint => uint)) public totalsByCustomerAndProduct;

    modifier onlyCustomer() {
        if (msg.sender == owner) {
            revert AuthorizationError("Not allowed for the owner.");
        }
        _;
    }

    modifier ifProductExists(uint _productId) {
        if (!productsCatalog[_productId]) {
            revert ProductMissingError("");
        }
        _;
    }

    /// @notice The owner of the store should be able to add new products and the quantity of them.
    /// @notice The owner should not be able to add the same product twice, just quantity.
    /// @dev if we don't expect explicit error to be thrown, single mapping of product id to quantity is sufficient to prevent duplicate entries.
    function addProduct(uint _productId, uint _quantity, uint _price) external onlyOwner {
        if (productsCatalog[_productId]) {
            revert ProductDuplicationError("It has already been added.");
        }

        if (_quantity == 0) {
            revert ProductQuantityError("Should be greater than zero.");
        }

        productsCatalog[_productId] = true;
        _makeAvailable(_productId);
        productsQuantities[_productId] = _quantity;
        productsPrices[_productId] = _price;
    }

    /// @notice The owner should be able to addjust the quantity.
    function updateQuantity(uint _productId, uint _quantity) external onlyOwner ifProductExists(_productId) {
        if (productsQuantities[_productId] == 0 && _quantity > 0) {
            _makeAvailable(_productId);
        }

        if (productsQuantities[_productId] > 0 && _quantity == 0) {
            _makeUnavailable(_productId);
        }
        
        productsQuantities[_productId] = _quantity;
    }

    /// @notice Customers should be able to buy products by their id.
    /// @notice A customer cannot buy the same product more than one time.
    /// @notice The customers should not be able to buy a product more times than the quantity in the store unless a product is returned or added by the owner.
    /// @dev requirements impose to use block number instead of actual timestamp
    function buyProduct(uint _productId) external payable onlyCustomer ifProductExists(_productId) {        
        if (productsQuantities[_productId] <= 0) {
            revert ProductQuantityError("It is sold out.");
        }

        address customer = msg.sender;
        if (customersOrders[customer][_productId]) {
            revert OrderError("The customer has already bought the same product.");
        }
        
        if (msg.value < productsPrices[_productId]) {
            revert PaymentError("The amount is not enought.");
        }

        customersOrders[customer][_productId] = true;
        productsQuantities[_productId] -= 1;

        uint price = productsPrices[_productId];
        totalsByCustomerAndProduct[customer][_productId] += price;

        uint change = msg.value - _toWei(price); 
        if (change != 0) {
            payable(msg.sender).transfer(change);
        }

        if (productsQuantities[_productId] == 0) {
             _makeUnavailable(_productId);
        }

        customersOrdersTimestamps[customer][_productId] = block.number;
        productsOrders[_productId].push(customer);
    }

    /// @notice Customers should be able to return products if they are not satisfied (within a certain period in blocktime: 100 blocks).
    /// @dev returning a product does not change the fact that a customer has purchased it
    function returnProduct(uint _productId) external onlyCustomer {
        address customer = msg.sender;
        if (!customersOrders[customer][_productId]) {
            revert ReturnError("The customer hasn't bought such product.");
        }

        uint boughtAt = customersOrdersTimestamps[customer][_productId];
        if (block.number - boughtAt > 100) {
            revert ReturnError("The deadline is not met.");
        }

        if (productsQuantities[_productId] == 0) {
            _makeAvailable(_productId);
            customersOrders[customer][_productId] = false;
        }

        productsQuantities[_productId] += 1;

        uint price = productsPrices[_productId];
        totalsByCustomerAndProduct[customer][_productId] -= price;

        uint refund = _toWei(price); 
        if (refund != 0) {
            payable(msg.sender).transfer(refund);
        }

        if (productsQuantities[_productId] == 0) {
             _makeUnavailable(_productId);
        }
    }

    /// @notice Customers should be able to see the available products.
    function getAvailableProducts() external view onlyCustomer returns (uint[] memory) {
        return availableProducts;
    }

    /// @notice Everyone should be able to see the addresses of all customers that have ever bought a given product.
    function getCustomersByProduct(uint _productId) external view returns (address[] memory) {
        return productsOrders[_productId];
    }

    function getTotalBallance() external view returns (uint) {
        return address(this).balance;
    }

    function _makeAvailable(uint _productId) private {
        availableProducts.push(_productId);
        int indexOfAddedId = int(availableProducts.length - 1);
        productsIndexes[_productId] = indexOfAddedId;
    }

    function _makeUnavailable(uint _productId) private {
        int indexOfRemovedId = int(productsIndexes[_productId]);
        uint lastProductId = availableProducts[availableProducts.length - 1];
        availableProducts[uint(indexOfRemovedId)] = lastProductId;
        productsIndexes[lastProductId] = indexOfRemovedId;
        productsIndexes[_productId] = -1;
        availableProducts.pop();
    }

    function _toWei(uint _amount) private pure returns (uint) {
        return _amount * 10 ** 18; 
    }
}