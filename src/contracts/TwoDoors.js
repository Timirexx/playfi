// Two Doors game contract — independent from the vault and the other games.
// The treasure door is generated on-chain by Hedera's PRNG; the backend keeper
// triggers the reveal via resolveGame.
//
// The address below is a PLACEHOLDER. Deploy the contract with:
//     node scripts/deployGame.js TwoDoors
// which overwrites this file with the real address + full ABI.
export const TWO_DOORS_ADDRESS = "0x0000000000000000000000000000000000000000";
export const TWO_DOORS_ABI = [
    "function placeBet() payable",
    "function chooseDoor(uint8 door)",
    "function reclaimStake()",
    "function getGame(address player) view returns (tuple(uint256 betAmount, uint8 chosenDoor, uint8 treasureDoor, uint8 status, bool won, uint64 stakedAt) game)",
    "function getStatus(address player) view returns (uint8)",
    "function getStats(address player) view returns (tuple(uint256 betsPlaced, uint256 totalWagered, uint256 totalWon) stats)",
    "event BetPlaced(address indexed player, uint256 betAmount)",
    "event GameStarted(address indexed player, uint256 betAmount)",
    "event DoorSelected(address indexed player, uint8 door)",
    "event GameWon(address indexed player, uint8 chosenDoor, uint8 treasureDoor, uint256 payout)",
    "event GameLost(address indexed player, uint8 chosenDoor, uint8 treasureDoor)",
    "event PayoutSent(address indexed player, uint256 amount)"
];
