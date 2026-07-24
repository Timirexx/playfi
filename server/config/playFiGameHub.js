// Single PlayFi game hub — backend config. The backend's authorized signer
// (TREASURY_PRIVATE_KEY, which must equal the hub's backendSigner) calls
// settleBet to pay winners through the treasury.
//
// PLACEHOLDER address until deployed. scripts/deployPlayFi.js overwrites it.
export const PLAYFI_HUB_ADDRESS = "0x0000000000000000000000000000000000000000";
export const PLAYFI_HUB_ABI = [
    "function placeBet(uint8 gameId) payable",
    "function settleBet(address player, uint8 gameId, uint256 winAmount)",
    "event BetPlaced(uint8 indexed gameId, address indexed player, uint256 amount)",
    "event BetSettled(uint8 indexed gameId, address indexed player, uint256 winAmount, bool won)"
];

export const GAME_ID = { MINES: 0, SPIN: 1, TWO_DOORS: 2 };
