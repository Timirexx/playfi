// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GameBase} from "./GameBase.sol";

/**
 * @title SpinToWin
 * @dev Independent, self-contained treasury + state machine for the Spin to Win game.
 * The wheel's landed slice is generated off-chain by the game server (weighted RNG),
 * matching the existing provably-fair backend design — this contract handles bet
 * custody, per-player bet tracking, and authorized payout settlement.
 */
contract SpinToWin is GameBase {
    struct PendingBet {
        uint256 betAmount;
        uint16 predictedMultiplier;
        bool active;
        uint64 placedAt;
    }

    struct PlayerStats {
        uint256 betsPlaced;
        uint256 totalWagered;
        uint256 totalWon;
    }

    mapping(address => PendingBet) public pendingBets;
    mapping(address => PlayerStats) public stats;

    event BetPlaced(address indexed player, uint256 betAmount, uint16 predictedMultiplier);
    event SpinResolved(
        address indexed player,
        uint16 predictedMultiplier,
        uint16 landedMultiplier,
        uint256 payoutAmount,
        bool won
    );

    error InvalidMultiplier();
    error BetAlreadyActive();
    error NoActiveBet();

    constructor(address initialOwner, address initialBackendSigner)
        GameBase(initialOwner, initialBackendSigner)
    {}

    function isValidMultiplier(uint16 multiplier) public pure returns (bool) {
        return multiplier == 1 ||
            multiplier == 2 ||
            multiplier == 4 ||
            multiplier == 5 ||
            multiplier == 10 ||
            multiplier == 20 ||
            multiplier == 40;
    }

    /**
     * @dev Place a wager predicting which multiplier slice the wheel will land on.
     */
    function placeBet(uint16 predictedMultiplier) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (!isValidMultiplier(predictedMultiplier)) revert InvalidMultiplier();
        if (pendingBets[msg.sender].active) revert BetAlreadyActive();

        pendingBets[msg.sender] = PendingBet({
            betAmount: msg.value,
            predictedMultiplier: predictedMultiplier,
            active: true,
            placedAt: uint64(block.timestamp)
        });

        houseLiquidity += msg.value;

        PlayerStats storage s = stats[msg.sender];
        s.betsPlaced += 1;
        s.totalWagered += msg.value;

        emit BetPlaced(msg.sender, msg.value, predictedMultiplier);
    }

    /**
     * @dev Backend settles the spin once the wheel outcome has been determined.
     * `payoutAmount` of 0 means the prediction missed and the wager is retained by the house.
     */
    function resolveSpin(address player, uint16 landedMultiplier, uint256 payoutAmount)
        external
        onlyBackend
        whenNotPaused
        nonReentrant
    {
        PendingBet storage b = pendingBets[player];
        if (!b.active) revert NoActiveBet();

        uint16 predicted = b.predictedMultiplier;
        b.active = false;

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

        emit SpinResolved(player, predicted, landedMultiplier, payoutAmount, payoutAmount > 0);
    }

    function getPendingBet(address player) external view returns (PendingBet memory) {
        return pendingBets[player];
    }

    function getStats(address player) external view returns (PlayerStats memory) {
        return stats[player];
    }
}
