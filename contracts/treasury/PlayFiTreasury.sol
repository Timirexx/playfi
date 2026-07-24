// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PlayFiTreasury
 * @dev The single shared treasury for all PlayFi games (Mines, Spin to Win,
 * Two Doors). It is a pure fund custodian — it contains NO game logic.
 *
 * Responsibilities:
 *   - Hold all game funds.
 *   - Take a 5% PlayFi platform fee out of every bet; the rest funds payouts.
 *   - Pay winners ONLY when instructed by an authorized game contract.
 *   - Let the owner withdraw accrued platform fees to the fee recipient wallet.
 *   - Provide pause + emergency withdrawal as a break-glass safety net.
 *
 * Trust model:
 *   - `owner`: cold admin key. Authorizes game contracts, sets the fee recipient,
 *     withdraws fees, pauses, and (only while paused) performs emergency recovery.
 *     It cannot pay arbitrary winners — that power belongs solely to games.
 *   - `authorizedGames`: the game contracts allowed to route bets in and instruct
 *     payouts. A compromised game can only move funds within normal game flow.
 *   - `feeRecipient`: the PlayFi platform wallet that accrued fees are sent to.
 */
contract PlayFiTreasury is Ownable, Pausable, ReentrancyGuard {
    /// @dev Platform fee in basis points (500 = 5%).
    uint256 public constant FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @dev Wallet that accrued platform fees are withdrawn to.
    address public feeRecipient;

    /// @dev Accrued, not-yet-withdrawn platform fees (tinybars/weibars).
    uint256 public platformFees;

    /// @dev HBAR available to cover winner payouts (bets minus fees, plus seeded liquidity).
    uint256 public payoutPool;

    /// @dev Game contracts allowed to route bets in and instruct payouts.
    mapping(address => bool) public authorizedGames;

    event GameAuthorizationChanged(address indexed game, bool authorized);
    event FeeRecipientChanged(address indexed previous, address indexed next);
    event BetReceived(address indexed game, address indexed player, uint256 amount, uint256 fee, uint256 toPool);
    event PayoutSent(address indexed game, address indexed winner, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event PoolFunded(address indexed from, uint256 amount);
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    error NotAuthorizedGame();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientPool();
    error InsufficientFees();
    error InsufficientBalance();
    error TransferFailed();

    constructor(address initialOwner, address initialFeeRecipient) Ownable(initialOwner) {
        if (initialFeeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = initialFeeRecipient;
        emit FeeRecipientChanged(address(0), initialFeeRecipient);
    }

    modifier onlyGame() {
        if (!authorizedGames[msg.sender]) revert NotAuthorizedGame();
        _;
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    /// @dev Authorize or revoke a game contract's access to receiveBet / payout.
    function setGameAuthorization(address game, bool authorized) external onlyOwner {
        if (game == address(0)) revert ZeroAddress();
        authorizedGames[game] = authorized;
        emit GameAuthorizationChanged(game, authorized);
    }

    /// @dev Update the wallet that platform fees are withdrawn to.
    function setFeeRecipient(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit FeeRecipientChanged(feeRecipient, next);
        feeRecipient = next;
    }

    // ------------------------------------------------------------------
    // Game-facing (authorized game contracts only)
    // ------------------------------------------------------------------

    /**
     * @dev Route a player's bet into the treasury. The game contract forwards the
     * full stake as msg.value; the treasury skims the 5% platform fee and credits
     * the remainder to the payout pool.
     */
    function receiveBet(address player) external payable onlyGame whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();

        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOMINATOR;
        uint256 toPool = msg.value - fee;

        platformFees += fee;
        payoutPool += toPool;

        emit BetReceived(msg.sender, player, msg.value, fee, toPool);
    }

    /**
     * @dev Pay a winner from the payout pool. Callable ONLY by an authorized game
     * contract — the treasury never decides who wins, it only executes the
     * instruction. CEI ordering + nonReentrant protect the transfer.
     */
    function payout(address winner, uint256 amount) external onlyGame whenNotPaused nonReentrant {
        if (winner == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > payoutPool) revert InsufficientPool();
        if (amount > address(this).balance) revert InsufficientBalance();

        payoutPool -= amount;

        (bool success, ) = payable(winner).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit PayoutSent(msg.sender, winner, amount);
    }

    // ------------------------------------------------------------------
    // Treasury management (owner)
    // ------------------------------------------------------------------

    /// @dev Seed extra payout liquidity (e.g. to cover large early wins).
    function fundPool() external payable onlyOwner {
        if (msg.value == 0) revert ZeroAmount();
        payoutPool += msg.value;
        emit PoolFunded(msg.sender, msg.value);
    }

    /// @dev Withdraw accrued platform fees to the fee recipient wallet.
    function withdrawFees(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > platformFees) revert InsufficientFees();
        if (amount > address(this).balance) revert InsufficientBalance();

        platformFees -= amount;

        (bool success, ) = payable(feeRecipient).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(feeRecipient, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Break-glass recovery: sweep the entire balance to the owner. Only while
     * paused, so it can't be used to quietly drain a live treasury.
     */
    function emergencyWithdraw() external onlyOwner whenPaused nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();

        platformFees = 0;
        payoutPool = 0;

        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit EmergencyWithdrawal(owner(), balance);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function totalBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
