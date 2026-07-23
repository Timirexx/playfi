// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GameBase} from "./GameBase.sol";

/**
 * @dev Hedera native Pseudo-Random Number Generator system contract (HIP-351),
 * exposed at 0.0.361 / EVM address 0x169. `getPseudorandomSeed()` returns a
 * 32-byte seed derived from the network's running hash at consensus time —
 * it cannot be predicted or influenced by the caller, the player, or the
 * frontend, which is exactly the property this game needs.
 */
interface IPrngSystemContract {
    function getPseudorandomSeed() external returns (bytes32);
}

/**
 * @title TwoDoors
 * @dev Independent, self-contained treasury + state machine for the Two Doors game.
 *
 * Security model for the "winning door" (the crux of this game):
 * -------------------------------------------------------------------------
 * The treasure door is generated ON-CHAIN using Hedera's PRNG system contract
 * at the moment of resolution — never on the frontend, and never passed in by
 * the backend. Resolution is triggered by the authorized `backendSigner`
 * (a keeper role), NOT by the player. This is deliberate: if the player's own
 * transaction both rolled the dice and paid out, a contract-wrapped attacker
 * could revert the transaction on a loss and retry until they win, draining
 * the treasury on a 50/50, 2x game. Because a non-player role triggers the
 * PRNG-backed reveal, that attack is impossible, while the outcome remains
 * fully on-chain, verifiable, and un-manipulable by anyone (the backend only
 * triggers the reveal; it cannot bias the Hedera-generated seed).
 *
 * Player flow:
 *   1. placeBet()            (payable)  -> stake HBAR into the treasury; game begins
 *   2. chooseDoor(door)                 -> player commits to door 1 or 2
 *   3. resolveGame(player)   (keeper)   -> PRNG picks the treasure door, pays 2x on a win
 *
 * Safety valve: if the keeper never resolves (e.g. backend outage), the player
 * can reclaim their stake after RESOLVE_TIMEOUT, so funds can never be trapped.
 */
contract TwoDoors is GameBase {
    address constant PRNG_SYSTEM_CONTRACT = address(0x169);

    /// @dev Payout multiplier for a correct guess (2x the stake).
    uint256 public constant PAYOUT_MULTIPLIER = 2;

    /// @dev How long after staking a player may reclaim an unresolved bet.
    uint256 public constant RESOLVE_TIMEOUT = 1 hours;

    enum Status {
        None,       // no game / previous game finished
        Staked,     // HBAR staked, awaiting door choice
        DoorChosen, // door picked, awaiting keeper resolution
        Resolved    // finished (win or loss)
    }

    struct Game {
        uint256 betAmount;
        uint8 chosenDoor;   // 0 until chosen, then 1 or 2
        uint8 treasureDoor; // 0 until resolved, then 1 or 2
        Status status;
        bool won;
        uint64 stakedAt;
    }

    struct PlayerStats {
        uint256 betsPlaced;
        uint256 totalWagered;
        uint256 totalWon;
    }

    mapping(address => Game) public games;
    mapping(address => PlayerStats) public stats;

    event BetPlaced(address indexed player, uint256 betAmount);
    event GameStarted(address indexed player, uint256 betAmount);
    event DoorSelected(address indexed player, uint8 door);
    event GameWon(address indexed player, uint8 chosenDoor, uint8 treasureDoor, uint256 payout);
    event GameLost(address indexed player, uint8 chosenDoor, uint8 treasureDoor);
    event PayoutSent(address indexed player, uint256 amount);
    event StakeReclaimed(address indexed player, uint256 amount);

    error InvalidDoor();
    error GameInProgress();
    error NotStaked();
    error NotAwaitingResolution();
    error NoReclaimableGame();
    error TimeoutNotReached();
    error PrngFailed();

    constructor(address initialOwner, address initialBackendSigner)
        GameBase(initialOwner, initialBackendSigner)
    {}

    // --------------------------------------------------------------------
    // Player actions
    // --------------------------------------------------------------------

    /**
     * @dev Step 1 — stake HBAR to begin a game. The wager goes into this
     * game's dedicated treasury (house liquidity). One active game per player.
     */
    function placeBet() external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert ZeroAmount();

        Game storage g = games[msg.sender];
        if (g.status == Status.Staked || g.status == Status.DoorChosen) revert GameInProgress();

        games[msg.sender] = Game({
            betAmount: msg.value,
            chosenDoor: 0,
            treasureDoor: 0,
            status: Status.Staked,
            won: false,
            stakedAt: uint64(block.timestamp)
        });

        houseLiquidity += msg.value;

        PlayerStats storage s = stats[msg.sender];
        s.betsPlaced += 1;
        s.totalWagered += msg.value;

        emit BetPlaced(msg.sender, msg.value);
        emit GameStarted(msg.sender, msg.value);
    }

    /**
     * @dev Step 2 — commit to a door (1 or 2). No randomness or payout happens
     * here; the outcome is decided only at resolution time by the PRNG.
     */
    function chooseDoor(uint8 door) external whenNotPaused nonReentrant {
        if (door != 1 && door != 2) revert InvalidDoor();

        Game storage g = games[msg.sender];
        if (g.status != Status.Staked) revert NotStaked();

        g.chosenDoor = door;
        g.status = Status.DoorChosen;

        emit DoorSelected(msg.sender, door);
    }

    /**
     * @dev Safety valve — if the game was never resolved within RESOLVE_TIMEOUT
     * (e.g. the keeper/backend was down), the player can void the game and
     * reclaim their stake. Cannot be used to dodge a resolved loss.
     */
    function reclaimStake() external nonReentrant {
        Game storage g = games[msg.sender];
        if (g.status != Status.Staked && g.status != Status.DoorChosen) revert NoReclaimableGame();
        if (block.timestamp < g.stakedAt + RESOLVE_TIMEOUT) revert TimeoutNotReached();

        uint256 refund = g.betAmount;
        g.status = Status.Resolved;

        // The stake was added to houseLiquidity on placeBet; unwind it.
        if (houseLiquidity >= refund) {
            houseLiquidity -= refund;
        } else {
            houseLiquidity = 0;
        }

        if (refund > address(this).balance) revert InsufficientContractBalance();
        (bool success, ) = payable(msg.sender).call{value: refund}("");
        if (!success) revert TransferFailed();

        emit StakeReclaimed(msg.sender, refund);
    }

    // --------------------------------------------------------------------
    // Keeper resolution
    // --------------------------------------------------------------------

    /**
     * @dev Step 3 — resolve the game. Only the authorized backend/owner may call
     * this. The treasure door is generated on-chain via Hedera's PRNG, compared
     * against the player's choice, and a winning player is paid 2x from the
     * treasury. CEI ordering + nonReentrant guard the payout.
     */
    function resolveGame(address player)
        external
        onlyBackend
        whenNotPaused
        nonReentrant
    {
        Game storage g = games[player];
        if (g.status != Status.DoorChosen) revert NotAwaitingResolution();

        uint8 treasureDoor = _treasureDoor();
        uint8 chosen = g.chosenDoor;
        bool won = (chosen == treasureDoor);

        // Effects before interaction.
        g.treasureDoor = treasureDoor;
        g.won = won;
        g.status = Status.Resolved;

        if (won) {
            uint256 payout = g.betAmount * PAYOUT_MULTIPLIER;
            if (payout > address(this).balance) revert InsufficientContractBalance();

            if (houseLiquidity >= payout) {
                houseLiquidity -= payout;
            } else {
                houseLiquidity = 0;
            }
            stats[player].totalWon += payout;

            (bool success, ) = payable(player).call{value: payout}("");
            if (!success) revert TransferFailed();

            emit GameWon(player, chosen, treasureDoor, payout);
            emit PayoutSent(player, payout);
        } else {
            emit GameLost(player, chosen, treasureDoor);
        }
    }

    /**
     * @dev Generates the treasure door (1 or 2) from Hedera's on-chain PRNG.
     * `virtual` so tests can deterministically override it — the 0x169 system
     * contract only exists on the Hedera network, not on a local EVM.
     */
    function _treasureDoor() internal virtual returns (uint8) {
        bytes32 seed = IPrngSystemContract(PRNG_SYSTEM_CONTRACT).getPseudorandomSeed();
        if (seed == bytes32(0)) revert PrngFailed();
        return uint8(uint256(seed) % 2) + 1;
    }

    // --------------------------------------------------------------------
    // Frontend views
    // --------------------------------------------------------------------

    function getGame(address player) external view returns (Game memory) {
        return games[player];
    }

    function getStatus(address player) external view returns (Status) {
        return games[player].status;
    }

    function getStats(address player) external view returns (PlayerStats memory) {
        return stats[player];
    }
}
