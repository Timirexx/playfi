// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITreasury} from "../treasury/ITreasury.sol";

/**
 * @title PlayFiGameHub
 * @dev The single game contract for all PlayFi games (Mines, Spin to Win,
 * Two Doors). It owns the on-chain bet/payout flow and is the ONLY contract
 * authorized to move funds in the shared PlayFiTreasury.
 *
 * Split of responsibilities:
 *   - This hub: takes player bets, forwards them to the treasury, and instructs
 *     the treasury to pay winners when the backend settles a game.
 *   - PlayFiTreasury: securely holds all funds, skims the 5% platform fee, and
 *     pays winners only when this hub tells it to.
 *
 * Outcome model: outcomes are decided off-chain by the authorized backend
 * (provably-fair, as the live games already do) and applied via settleBet.
 * The backend is a hot key distinct from the cold owner key, so a compromised
 * backend can only settle games — it can't repoint the treasury, pause, or
 * rotate itself. The treasury's payout pool is the hard cap on any single
 * settlement, bounding the blast radius further.
 */
contract PlayFiGameHub is Ownable, Pausable, ReentrancyGuard {
    /// @dev Game identifiers used for event tagging / analytics.
    uint8 public constant GAME_MINES = 0;
    uint8 public constant GAME_SPIN = 1;
    uint8 public constant GAME_TWO_DOORS = 2;
    uint8 public constant MAX_GAME_ID = 2;

    ITreasury public treasury;
    address public backendSigner;

    event BetPlaced(uint8 indexed gameId, address indexed player, uint256 amount);
    event BetSettled(uint8 indexed gameId, address indexed player, uint256 winAmount, bool won);
    event TreasuryUpdated(address indexed previous, address indexed next);
    event BackendSignerUpdated(address indexed previous, address indexed next);

    error InvalidGame();
    error ZeroAmount();
    error ZeroAddress();
    error NotBackend();

    constructor(address initialOwner, address treasuryAddress, address initialBackendSigner) Ownable(initialOwner) {
        if (treasuryAddress == address(0) || initialBackendSigner == address(0)) revert ZeroAddress();
        treasury = ITreasury(treasuryAddress);
        backendSigner = initialBackendSigner;
        emit TreasuryUpdated(address(0), treasuryAddress);
        emit BackendSignerUpdated(address(0), initialBackendSigner);
    }

    modifier onlyBackend() {
        if (msg.sender != backendSigner && msg.sender != owner()) revert NotBackend();
        _;
    }

    // ------------------------------------------------------------------
    // Player
    // ------------------------------------------------------------------

    /**
     * @dev Place a bet on a game. The full stake is forwarded to the treasury,
     * which skims the 5% platform fee and pools the rest for payouts.
     */
    function placeBet(uint8 gameId) external payable whenNotPaused nonReentrant {
        if (gameId > MAX_GAME_ID) revert InvalidGame();
        if (msg.value == 0) revert ZeroAmount();

        treasury.receiveBet{value: msg.value}(msg.sender);

        emit BetPlaced(gameId, msg.sender, msg.value);
    }

    // ------------------------------------------------------------------
    // Backend settlement
    // ------------------------------------------------------------------

    /**
     * @dev Settle a game result. Called by the authorized backend once the
     * outcome is decided. A winAmount of 0 is a loss (funds already sit in the
     * treasury); a positive winAmount pays the player from the treasury pool.
     */
    function settleBet(address player, uint8 gameId, uint256 winAmount)
        external
        onlyBackend
        nonReentrant
    {
        if (gameId > MAX_GAME_ID) revert InvalidGame();
        if (player == address(0)) revert ZeroAddress();

        if (winAmount > 0) {
            treasury.payout(player, winAmount);
        }

        emit BetSettled(gameId, player, winAmount, winAmount > 0);
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setTreasury(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(address(treasury), next);
        treasury = ITreasury(next);
    }

    function setBackendSigner(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        emit BackendSignerUpdated(backendSigner, next);
        backendSigner = next;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
