// Single unified treasury contract (PlayFiVault) powering the Staking Vault,
// Mines, Spin to Win, and Two Doors. Keep in sync with src/contracts/PlayFiVault.js.
export const TREASURY_ADDRESS = "0xAc7829fE9997C5112CA88C1f743948767f8814C1";

export const TREASURY_SETTLE_ABI = [
    "function settleGame(address user, uint256 winAmount) public"
];
