const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting PlayFiVault deployment to Hedera Testnet...");

  // Get the contract factory
  const PlayFiVault = await hre.ethers.getContractFactory("PlayFiVault");

  // Deploy the contract
  const vault = await PlayFiVault.deploy();

  // Wait for the deployment to complete
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  
  console.log("\n✅ Deployment SUCCESSful!");
  console.log(`🏰 PlayFiVault Address: ${vaultAddress}`);
  console.log(`🌐 Verify on Hashscan: https://hashscan.io/testnet/contract/${vaultAddress}`);
  console.log("\nGrant reviewers can now track TVL and transaction volume via on-chain events.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
