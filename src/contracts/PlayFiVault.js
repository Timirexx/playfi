// Single unified treasury for the whole platform: Staking Vault, Mines, Spin to Win, Two Doors.
export const PLAYFI_VAULT_ADDRESS = "0xAc7829fE9997C5112CA88C1f743948767f8814C1";
export const PLAYFI_VAULT_ABI = [
    "function owner() public view returns (address)",
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function userBalances(address) public view returns (uint256)",
    "function settleGame(address user, uint256 winAmount, uint256 lossAmount) public",
    "function placeBet() public payable",
    "function settleGame(address user, uint256 winAmount) public",
    "function houseLiquidity() public view returns (uint256)",
    "function fundHouse() public payable",
    "function withdrawHouse(uint256 amount) public",
    "function getVaultBalance() public view returns (uint256)",
    "function authorizedGames(address) public view returns (bool)",
    "function setGameAuthorization(address gameContract, bool status) public",
    "event Deposited(address indexed user, uint256 amount)",
    "event Withdrawn(address indexed user, uint256 amount)",
    "event BetPlaced(address indexed user, uint256 amount)",
    "event GameResult(address indexed user, uint256 won, uint256 lost)",
    "event HouseFunded(uint256 amount)",
    "event HouseWithdrawn(uint256 amount)"
];
