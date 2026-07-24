// Single PlayFi game hub for Mines (0), Spin to Win (1), Two Doors (2).
// Players bet through this contract; funds flow to the shared PlayFiTreasury.
//
// PLACEHOLDER address until deployed. Run:
//     node scripts/deployPlayFi.js
// which overwrites this file (and the backend config) with the real address + ABI.
export const PLAYFI_HUB_ADDRESS = "0x0000000000000000000000000000000000000000";
export const PLAYFI_HUB_ABI = [
    "function placeBet(uint8 gameId) payable",
    "function settleBet(address player, uint8 gameId, uint256 winAmount)",
    "function treasury() view returns (address)",
    "function backendSigner() view returns (address)",
    "function paused() view returns (bool)",
    "event BetPlaced(uint8 indexed gameId, address indexed player, uint256 amount)",
    "event BetSettled(uint8 indexed gameId, address indexed player, uint256 winAmount, bool won)"
];

// gameId values (match PlayFiGameHub constants).
export const GAME_ID = { MINES: 0, SPIN: 1, TWO_DOORS: 2 };
