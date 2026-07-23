// Two Doors backend config — points at the already-deployed shared treasury
// (formerly "GameTreasury") on Hedera testnet. The backend verifies the bet
// transaction, decides the 50/50 outcome, and pays winners via settleGame.
//
// The backend signs with TREASURY_PRIVATE_KEY, which must be authorized on this
// contract (owner or an authorizedGames entry) to call settleGame.
export const TWO_DOORS_ADDRESS = "0x83F2DAEE3765ffEFdD02812E96d23Bb293ae0EAF";
export const TWO_DOORS_SETTLE_ABI = [
    "function settleGame(address user, uint256 winAmount) public"
];
