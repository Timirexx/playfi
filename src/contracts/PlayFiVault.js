export const PLAYFI_VAULT_ADDRESS = "0xAc7829fE9997C5112CA88C1f743948767f8814C1";
export const PLAYFI_VAULT_ABI = [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function userBalances(address) public view returns (uint256)",
    "function settleGame(address user, uint256 winAmount, uint256 lossAmount) public",
    "event Deposited(address indexed user, uint256 amount)",
    "event Withdrawn(address indexed user, uint256 amount)"
];
