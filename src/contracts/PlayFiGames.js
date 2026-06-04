export const PLAYFI_GAMES_ADDRESS = "0x4D1D4A97330e99b959989abd5ea97a347ACba02D";
export const PLAYFI_GAMES_ABI = [
    "function startMines(uint256 minesCount, uint256 amount) public",
    "function revealTile(uint256 tileIndex) public",
    "function cashoutMines() public",
    "function playSpin(uint256 amount) public",
    "event SpinPlayed(address indexed user, uint256 bet, uint256 multiplier, uint256 winAmount)",
    "event MinesStarted(address indexed user, uint256 bet, uint256 minesCount)",
    "event MinesRevealed(address indexed user, uint256 tileIndex, bool isMine)",
    "event MinesCashout(address indexed user, uint256 payout)"
];
