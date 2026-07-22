// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PlayFiVault
 * @dev The single unified treasury for the entire PlayFi platform.
 * Powers the Staking Vault (deposit/withdraw against a per-user balance) as well as
 * every game (Mines, Spin to Win, Two Doors) via the pay-per-bet placeBet/settleGame flow.
 * Users can withdraw their winnings/staked balance at any time.
 */
contract PlayFiVault {
    address public owner;

    // Internal balances mapping: user address => balance in tinybars
    mapping(address => uint256) public userBalances;

    // Total liquidity provided by the house. Game payouts are capped strictly
    // to this amount so they can never dip into stakers' deposited balances.
    uint256 public houseLiquidity;

    bool private locked;

    modifier nonReentrant() {
        require(!locked, "PlayFi: Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event GameResult(address indexed user, uint256 won, uint256 lost);
    event HouseFunded(uint256 amount);
    event HouseWithdrawn(uint256 amount);
    event BetPlaced(address indexed user, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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
     * @dev Deposit HBAR into the player's internal balance.
     * Rewards (10 Stars per 1 HBAR) are handled on the frontend for immediate feedback.
     */
    function deposit() public payable {
        require(msg.value > 0, "PlayFi: Deposit amount must be greater than 0");
        userBalances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw HBAR from the player's internal balance.
     * Follows CEI pattern to prevent reentrancy.
     */
    function withdraw(uint256 amount) public nonReentrant {
        require(amount > 0, "PlayFi: Withdraw amount must be greater than 0");
        require(userBalances[msg.sender] >= amount, "PlayFi: Insufficient balance");

        // Effects
        userBalances[msg.sender] -= amount;

        // Interactions
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "PlayFi: Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @dev Backend calls this to settle a game result where the stake was drawn
     * from the user's internal balance (balance-based games).
     * Payouts are capped strictly to houseLiquidity so a win can never be paid
     * out of another user's deposited (staked) balance.
     */
    function settleGame(address user, uint256 winAmount, uint256 lossAmount) public onlyAuthorized nonReentrant {
        if (lossAmount > 0) {
            require(userBalances[user] >= lossAmount, "PlayFi: User has insufficient balance to cover loss");
            userBalances[user] -= lossAmount;
            houseLiquidity += lossAmount;
        }

        if (winAmount > 0) {
            // Effects first (CEI): cap to houseLiquidity, never touch staked deposits.
            require(houseLiquidity >= winAmount, "PlayFi: Insufficient house liquidity for payout");
            houseLiquidity -= winAmount;

            // Interactions
            (bool success, ) = payable(user).call{value: winAmount}("");
            require(success, "PlayFi: Transfer failed");
        }

        emit GameResult(user, winAmount, lossAmount);
    }

    /**
     * @dev Place a pay-per-bet wager (used by Mines, Spin to Win, Two Doors).
     * The sent HBAR is immediately added to house liquidity; the game outcome
     * is decided off-chain and settled via settleGame(user, winAmount).
     */
    function placeBet() public payable {
        require(msg.value > 0, "PlayFi: Bet amount must be greater than 0");
        houseLiquidity += msg.value;
        emit BetPlaced(msg.sender, msg.value);
    }

    /**
     * @dev Backend calls this to settle a pay-per-bet game result.
     * Since the wager was already added to houseLiquidity in placeBet(),
     * we only need to transfer winnings if the player won.
     */
    function settleGame(address user, uint256 winAmount) public onlyAuthorized nonReentrant {
        if (winAmount > 0) {
            // Effects first (CEI): cap to houseLiquidity, never touch staked deposits.
            require(houseLiquidity >= winAmount, "PlayFi: Insufficient house liquidity for payout");
            houseLiquidity -= winAmount;

            // Interactions
            (bool success, ) = payable(user).call{value: winAmount}("");
            require(success, "PlayFi: Transfer failed");
        }

        emit GameResult(user, winAmount, 0);
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
    function withdrawHouse(uint256 amount) public onlyOwner nonReentrant {
        require(houseLiquidity >= amount, "PlayFi: Insufficient house liquidity");

        houseLiquidity -= amount;
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "PlayFi: House transfer failed");

        emit HouseWithdrawn(amount);
    }

    /**
     * @dev Transfer contract ownership to a new address.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "PlayFi: New owner is the zero address");
        owner = newOwner;
        emit OwnershipTransferred(msg.sender, newOwner);
    }

    /**
     * @dev Helper to get contract balance.
     */
    function getVaultBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
