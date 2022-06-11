// SPDX-License-Identifier: MIT
pragma solidity 0.8.5;

error AuthorizationError(string message);
error ProductMissingError(string message);
error ProductQuantityError(string message);
error ProductDuplicationError(string message);
error OrderError(string message);
error ReturnError(string message);
error PaymentError(string message);

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "./LimeToken.sol";

contract Store is Ownable {
    LimeToken private token;

    /// @dev for fast lookup whether a product is already added to the store
    mapping (uint => bool) private productsCatalog;

    /// @dev for fast lookup of products that are still available to purchase
    uint[] private availableProducts;

    /// @dev keeps track of the indexes of all available product ids
    mapping (uint => int) private productsIndexes;

    /// @dev keeps track of all products quantities
    mapping (uint => uint) private productsQuantities;

    /// @dev keeps track of all products prices
    mapping (uint => uint) private productsPrices;

    /// @dev for fast lookup of the customers that bought specific product
    mapping (uint => address[]) private productsOrders;

    /// @dev for fast lookup whether a customer has bought a specific product only once
    mapping (address => mapping (uint => bool)) private customersOrders;

    /// @dev keeps track of orders timestamps (since it is not allowed for a customer to buy a specific product more than once)
    mapping (address => mapping (uint => uint)) private customersOrdersTimestamps;
    
    /// @dev keeps track of the order totals by customer, product, and price
    mapping (address => mapping (uint => uint)) public totalsByCustomerAndProduct;

    event ProductAdded(uint indexed productId, uint quantity, uint price);
    event QuantityUpdated(uint indexed productId, uint quantity);
    event OrderPlaced(uint indexed productId);
    event ReturnInitiated(uint indexed productId);

    modifier onlyCustomer() {
        if (msg.sender == owner()) {
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

    receive() external payable {
        wrap();
    }

    constructor() {
        // token = LimeToken(tokenAddress);
        token = new LimeToken();
    }

    function wrap() public payable {
        require(msg.value > 0, "Amount should be at least 1 wei");
        // eoa (msg.sender) -> ETH wrap()
        // store contract (this) owner -> mint() LMT
        token.mint(msg.sender, msg.value);
        // token.approve(address(this), msg.value);
        // token.approve(address(token), msg.value);
        token.approve(msg.sender, msg.value);
        console.log(token.allowance(address(this), msg.sender));
    }

    function unwrap(uint256 amount) public {
        require(amount > 0, "Amount should be at least 1 wei");
        // ex. account (msg.sender) -> unwrap()
        // store contract (this) -> transferFrom()
        // eoa <- ETH
        // store contract <- MLT burn
        token.transferFrom(msg.sender, address(this), amount);
        token.burn(amount);
        payable(msg.sender).transfer(amount);
    }

    function getTokenBalance() external view returns (uint256) {
        return token.balanceOf(msg.sender);
    }

    /// @notice The owner of the store should be able to add new products and the quantity of them.
    /// @notice The owner should not be able to add the same product twice, just quantity.
    /// @dev if we don't expect an explicit error to be thrown, a single mapping of product id to quantity is sufficient to prevent duplicate entries.
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

        emit ProductAdded(_productId, _quantity, _price);
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

        emit QuantityUpdated(_productId, _quantity);
    }

    /// @notice Customers should be able to buy products by their id.
    /// @notice A customer cannot buy the same product more than one time.
    /// @notice The customers should not be able to buy a product more times than the quantity in the store unless a product is returned or added by the owner.
    /// @dev requirements impose to use block number instead of actual timestamp
    function buyProduct(uint _productId) external payable onlyCustomer ifProductExists(_productId) {        
        if (productsQuantities[_productId] == 0) {
            revert ProductQuantityError("It is sold out.");
        }

        address customer = msg.sender;
        if (customersOrders[customer][_productId]) {
            revert OrderError("The customer has already bought the same product.");
        }
        
        uint price = productsPrices[_productId];
        if (msg.value < price) {
            revert PaymentError("The amount is not enought.");
        }

        customersOrders[customer][_productId] = true;

        if (customersOrdersTimestamps[customer][_productId] == 0) {
            customersOrdersTimestamps[customer][_productId] = block.number;
            productsOrders[_productId].push(customer);
        } else {
            customersOrdersTimestamps[customer][_productId] = block.number;
        }

        productsQuantities[_productId] -= 1;

        if (productsQuantities[_productId] == 0) {
             _makeUnavailable(_productId);
        }

        totalsByCustomerAndProduct[customer][_productId] += price;
        
        uint change = msg.value - _toWei(price);
        if (change != 0) {
            payable(msg.sender).transfer(change);
        }

        emit OrderPlaced(_productId);
    }

    /// @notice Customers should be able to return products if they are not satisfied (within a certain period in blocktime: 100 blocks).
    /// @dev does returning a product change the fact that a customer has ever bought it?
    function returnProduct(uint _productId) external onlyCustomer {
        address customer = msg.sender;
        if (!customersOrders[customer][_productId]) {
            revert ReturnError("The customer hasn't bought such product.");
        }

        uint boughtAt = customersOrdersTimestamps[customer][_productId];
        if (block.number - boughtAt > 100) {
            revert ReturnError("The deadline is not met.");
        }

        customersOrders[customer][_productId] = false;
        
        if (productsQuantities[_productId] == 0) {
            _makeAvailable(_productId);
        }

        productsQuantities[_productId] += 1;

        uint price = productsPrices[_productId];
        totalsByCustomerAndProduct[customer][_productId] -= price;

        uint refund = _toWei(price); 
        payable(msg.sender).transfer(refund);

        emit ReturnInitiated(_productId);
    }

    /// @notice Customers should be able to see the available products.
    function getAvailableProducts() external view onlyCustomer returns (uint[] memory) {
        return availableProducts;
    }

    /// @notice Everyone should be able to see the addresses of all customers that have ever bought a given product.
    function getCustomersByProduct(uint _productId) external view returns (address[] memory) {
        return productsOrders[_productId];
    }

    function getTotalBallance() external view onlyOwner returns (uint) {
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