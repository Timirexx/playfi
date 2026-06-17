// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GameTreasury
 * @dev A secure treasury for the PlayFi gaming platform (Mines, Spin to Win).
 * Users can deposit HBAR to play games, and the platform owner can record wins/losses.
 * Users can withdraw their winnings at any time.
 */
contract GameTreasury {
    address public owner;
    
    // Total liquidity provided by the house
    uint256 public houseLiquidity;

    event BetPlaced(address indexed user, uint256 amount);
    event GameResult(address indexed user, uint256 won);
    event HouseFunded(uint256 amount);
    event HouseWithdrawn(uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "PlayFi: Caller is not the owner");
        _;
    }

    mapping(address => bool) public authorizedGames;

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedGames[msg.sender], "PlayFi: Not authorized");
        _;
    }

    function setGameAuthorization(address gameContract, bool status) public onlyOwner {
        authorizedGames[gameContract] = status;
    }

    /**
     * @dev Place a bet. The sent HBAR is immediately added to house liquidity.
     * The game outcome is decided by the backend.
     */
    function placeBet() public payable {
        require(msg.value > 0, "PlayFi: Bet amount must be greater than 0");
        houseLiquidity += msg.value;
        emit BetPlaced(msg.sender, msg.value);
    }

    /**
     * @dev Backend calls this to settle a game result.
     * Since the loss was already added to houseLiquidity in placeBet(),
     * we only need to transfer winnings if the player won.
     */
    function settleGame(address user, uint256 winAmount) public onlyAuthorized {
        if (winAmount > 0) {
            require(address(this).balance >= winAmount, "PlayFi: Vault has insufficient liquidity for payout");
            if (houseLiquidity >= winAmount) {
                houseLiquidity -= winAmount;
            } else {
                houseLiquidity = 0; // Prevent underflow if manually funded
            }
            
            // Transfer directly to the user's wallet
            (bool success, ) = payable(user).call{value: winAmount}("");
            require(success, "PlayFi: Transfer failed");
        }
        
        emit GameResult(user, winAmount);
    }

    /**
     * @dev Fund the house liquidity to cover potential big wins.
     */
    function fundHouse() public payable onlyOwner {
        houseLiquidity += msg.value;
        emit HouseFunded(msg.value);
    }

    /**
     * @dev Withdraw house profits/liquidity.
     */
    function withdrawHouse(uint256 amount) public onlyOwner {
        require(address(this).balance >= amount, "PlayFi: Insufficient vault balance");
        require(houseLiquidity >= amount, "PlayFi: Insufficient house liquidity");
        
        houseLiquidity -= amount;
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "PlayFi: House transfer failed");
        
        emit HouseWithdrawn(amount);
    }

    /**
     * @dev Helper to get contract balance.
     */
    function getVaultBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
