// Two Doors game — points at the already-deployed, funded shared treasury
// (formerly "GameTreasury") on Hedera testnet. This is a live contract with
// placeBet() + settleGame(), so the game works without deploying anything new.
//
// The fully-independent, on-chain-PRNG TwoDoors contract lives in
// contracts/games/TwoDoors.sol and is ready to deploy (scripts/deployGame.js
// TwoDoors) whenever a funded deployer key is available; switch this address +
// ABI to that deployment to upgrade.
export const TWO_DOORS_ADDRESS = "0x83F2DAEE3765ffEFdD02812E96d23Bb293ae0EAF";
export const TWO_DOORS_ABI = [
    "function placeBet() public payable",
    "function settleGame(address user, uint256 winAmount) public",
    "function houseLiquidity() public view returns (uint256)",
    "function getVaultBalance() public view returns (uint256)",
    "event BetPlaced(address indexed user, uint256 amount)",
    "event GameResult(address indexed user, uint256 won)"
];
