// Two Doors game contract config for the backend keeper.
// The backend's authorized signer (TREASURY_PRIVATE_KEY, which must equal the
// contract's backendSigner) calls resolveGame to trigger the on-chain PRNG reveal.
//
// The address below is a PLACEHOLDER. Deploying with
//     node scripts/deployGame.js TwoDoors
// overwrites this file with the real address + full ABI.
export const TWO_DOORS_ADDRESS = "0x0000000000000000000000000000000000000000";
export const TWO_DOORS_ABI = [
    "function resolveGame(address player)",
    "function getGame(address player) view returns (tuple(uint256 betAmount, uint8 chosenDoor, uint8 treasureDoor, uint8 status, bool won, uint64 stakedAt) game)",
    "function getStatus(address player) view returns (uint8)",
    "event GameWon(address indexed player, uint8 chosenDoor, uint8 treasureDoor, uint256 payout)",
    "event GameLost(address indexed player, uint8 chosenDoor, uint8 treasureDoor)",
    "event PayoutSent(address indexed player, uint256 amount)"
];

// Matches TwoDoors.Status in the contract.
export const TWO_DOORS_STATUS = {
    NONE: 0,
    STAKED: 1,
    DOOR_CHOSEN: 2,
    RESOLVED: 3,
};
