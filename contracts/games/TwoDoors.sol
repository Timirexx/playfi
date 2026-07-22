// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GameBase} from "./GameBase.sol";

/**
 * @title TwoDoors
 * @dev Independent, self-contained treasury + state machine for the Two Doors game.
 * The treasure door is chosen off-chain by the game server (50/50), matching the
 * existing provably-fair backend design — this contract handles bet custody,
 * per-player bet tracking, and authorized payout settlement.
 */
contract TwoDoors is GameBase {
    struct PendingBet {
        uint256 betAmount;
        uint8 selectedDoor;
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

    event BetPlaced(address indexed player, uint256 betAmount, uint8 selectedDoor);
    event GameResolved(
        address indexed player,
        uint8 selectedDoor,
        uint8 treasureDoor,
        uint256 payoutAmount,
        bool won
    );

    error InvalidDoor();
    error BetAlreadyActive();
    error NoActiveBet();

    constructor(address initialOwner, address initialBackendSigner)
        GameBase(initialOwner, initialBackendSigner)
    {}

    function _isValidDoor(uint8 door) private pure returns (bool) {
        return door == 1 || door == 2;
    }

    /**
     * @dev Place a wager on one of the two doors (1 or 2).
     */
    function placeBet(uint8 selectedDoor) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (!_isValidDoor(selectedDoor)) revert InvalidDoor();
        if (pendingBets[msg.sender].active) revert BetAlreadyActive();

        pendingBets[msg.sender] = PendingBet({
            betAmount: msg.value,
            selectedDoor: selectedDoor,
            active: true,
            placedAt: uint64(block.timestamp)
        });

        houseLiquidity += msg.value;

        PlayerStats storage s = stats[msg.sender];
        s.betsPlaced += 1;
        s.totalWagered += msg.value;

        emit BetPlaced(msg.sender, msg.value, selectedDoor);
    }

    /**
     * @dev Backend settles the round once the treasure door has been determined.
     * `payoutAmount` of 0 means the player picked the wrong door.
     */
    function resolveGame(address player, uint8 treasureDoor, uint256 payoutAmount)
        external
        onlyBackend
        whenNotPaused
        nonReentrant
    {
        if (!_isValidDoor(treasureDoor)) revert InvalidDoor();

        PendingBet storage b = pendingBets[player];
        if (!b.active) revert NoActiveBet();

        uint8 selected = b.selectedDoor;
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

        emit GameResolved(player, selected, treasureDoor, payoutAmount, payoutAmount > 0);
    }

    function getPendingBet(address player) external view returns (PendingBet memory) {
        return pendingBets[player];
    }

    function getStats(address player) external view returns (PlayerStats memory) {
        return stats[player];
    }
}
