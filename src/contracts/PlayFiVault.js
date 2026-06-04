export const PLAYFI_VAULT_ADDRESS = "0x434BcA79801eB0d0E1838d63B8Bc1FCb09040d28";
export const PLAYFI_VAULT_ABI = [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function userBalances(address) public view returns (uint256)",
    "function settleGame(address user, uint256 winAmount, uint256 lossAmount) public",
    "event Deposited(address indexed user, uint256 amount)",
    "event Withdrawn(address indexed user, uint256 amount)"
];
