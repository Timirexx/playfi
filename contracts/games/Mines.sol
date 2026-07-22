// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GameBase} from "./GameBase.sol";

/**
 * @title Mines
 * @dev Independent, self-contained treasury + state machine for the Mines game.
 * 30-tile grid (matches the frontend's 6x5 layout). The mine layout and reveal
 * outcomes are generated off-chain by the game server using a commit-reveal
 * scheme (server seed hash committed before the bet, seed revealed after) —
 * Solidity has no secure native randomness, so this contract's job is bet
 * custody, per-player round tracking, and authorized payout settlement, not
 * generating the grid itself.
 */
contract Mines is GameBase {
    uint8 public constant TOTAL_TILES = 30;
    uint8 public constant MIN_MINES = 1;
    uint8 public constant MAX_MINES = 29;

    struct Round {
        uint256 betAmount;
        uint8 minesCount;
        uint8 revealedCount;
        bool active;
        uint64 startedAt;
    }

    struct PlayerStats {
        uint256 roundsPlayed;
        uint256 totalWagered;
        uint256 totalWon;
    }

    mapping(address => Round) public rounds;
    mapping(address => PlayerStats) public stats;

    event RoundStarted(address indexed player, uint256 betAmount, uint8 minesCount);
    event RoundResolved(address indexed player, uint8 revealedCount, uint256 payoutAmount, bool won);

    error InvalidMinesCount();
    error RoundAlreadyActive();
    error NoActiveRound();
    error InvalidRevealedCount();

    constructor(address initialOwner, address initialBackendSigner)
        GameBase(initialOwner, initialBackendSigner)
    {}

    /**
     * @dev Start a new round by wagering `msg.value` HBAR against `minesCount` mines.
     */
    function startGame(uint8 minesCount) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (minesCount < MIN_MINES || minesCount > MAX_MINES) revert InvalidMinesCount();
        if (rounds[msg.sender].active) revert RoundAlreadyActive();

        rounds[msg.sender] = Round({
            betAmount: msg.value,
            minesCount: minesCount,
            revealedCount: 0,
            active: true,
            startedAt: uint64(block.timestamp)
        });

        houseLiquidity += msg.value;

        PlayerStats storage s = stats[msg.sender];
        s.roundsPlayed += 1;
        s.totalWagered += msg.value;

        emit RoundStarted(msg.sender, msg.value, minesCount);
    }

    /**
     * @dev Backend settles the round once the player busts or cashes out.
     * `payoutAmount` of 0 means the player hit a mine and lost their wager.
     */
    function resolveRound(address player, uint8 revealedCount, uint256 payoutAmount)
        external
        onlyBackend
        whenNotPaused
        nonReentrant
    {
        Round storage r = rounds[player];
        if (!r.active) revert NoActiveRound();
        if (revealedCount > TOTAL_TILES - r.minesCount) revert InvalidRevealedCount();

        r.active = false;
        r.revealedCount = revealedCount;

        if (payoutAmount > 0) {
            if (payoutAmount > address(this).balance) revert InsufficientContractBalance();

            if (houseLiquidity >= payoutAmount) {
                houseLiquidity -= payoutAmount;
            } else {
                houseLiquidity = 0;
            }

            stats[player].totalWon += payoutAmount;

            (bool success, ) = payable(player).call{value: payoutAmount}("");
            if (!success) revert TransferFailed();
        }

        emit RoundResolved(player, revealedCount, payoutAmount, payoutAmount > 0);
    }

    function getRound(address player) external view returns (Round memory) {
        return rounds[player];
    }

    function getStats(address player) external view returns (PlayerStats memory) {
        return stats[player];
    }
}
