// scripts/deployEcosystem.js
import hre from "hardhat";

async function main() {
    console.log("🚀 Starting PlayFi Ecosystem Deployment...");

    // 1. Deploy the PlayToken (ERC-20)
    console.log("Deploying PlayToken...");
    const PlayToken = await hre.ethers.getContractFactory("PlayToken");
    const playToken = await PlayToken.deploy();
    await playToken.waitForDeployment();
    
    const tokenAddress = await playToken.getAddress();
    console.log(`✅ PlayToken deployed to: ${tokenAddress}`);

    // Wait a brief moment for Hedera mirror node indexing to prevent dependency errors
    await new Promise(r => setTimeout(r, 6000));

    // 2. Deploy the Yield-Farming PlayFiVault
    console.log(`\nDeploying PlayFiVault...`);
    const PlayFiVault = await hre.ethers.getContractFactory("PlayFiVault");
    const playFiVault = await PlayFiVault.deploy(tokenAddress);
    await playFiVault.waitForDeployment();
    
    const vaultAddress = await playFiVault.getAddress();
    console.log(`✅ PlayFiVault deployed to: ${vaultAddress}`);

    await new Promise(r => setTimeout(r, 6000));

    // 3. Fund the Vault with PLAY token supply so it can pay out yield
    console.log(`\nFunding Vault Treasury with 5,000,000 PLAY tokens...`);
    const fiftyPercentSupply = hre.ethers.parseUnits("5000000", 18); // 5 Million Tokens
    const transferTx = await playToken.transfer(vaultAddress, fiftyPercentSupply);
    await transferTx.wait();
    console.log(`✅ Successfully funded Vault reserve!`);

    console.log("\n==================================");
    console.log("ECOSYSTEM DEPLOYMENT SUCCESSFUL:");
    console.log(`PLAY_TOKEN_ADDRESS: ${tokenAddress}`);
    console.log(`VAULT_ADDRESS: ${vaultAddress}`);
    console.log("==================================");
}

main().catch((error) => {
    console.error("❌ Ecosystem Deployment Failed:", error);
    process.exitCode = 1;
});
