// scripts/deployEcosystemDirect.js
import fs from "fs";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Starting PlayFi Ecosystem Deployment (Pure Ethers)...");

    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(process.env.TESTNET_PRIVATE_KEY, provider);

    // 1. Target the Native HTS Token (Computed EVM Address)
    const tokenAddress = "0x00000000000000000000000000000000008529cf";
    console.log(`🚀 Targeting Native HTS Token: ${tokenAddress} (0.0.8726991)`);

    // Load compiled artifacts
    const vaultArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/PlayFiVault.sol/PlayFiVault.json", "utf8"));

    await new Promise(r => setTimeout(r, 6000));

    // 2. Deploy the Yield-Farming PlayFiVault
    console.log(`\nDeploying PlayFiVault...`);
    const VaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
    const playFiVault = await VaultFactory.deploy(tokenAddress);
    await playFiVault.waitForDeployment();
    
    const vaultAddress = await playFiVault.getAddress();
    console.log(`✅ PlayFiVault deployed to: ${vaultAddress}`);

    await new Promise(r => setTimeout(r, 6000));

    // 3. Fund the Vault with PLAY token supply so it can pay out yield
    console.log(`\nFunding Vault Treasury with 5,000,000 PLAY tokens...`);
    const minERC20Abi = [
        "function transfer(address to, uint256 amount) public returns (bool)",
        "function decimals() public view returns (uint8)"
    ];
    const playToken = new ethers.Contract(tokenAddress, minERC20Abi, wallet);
    const fiftyPercentSupply = ethers.parseUnits("1000000", 8); // HTS token created with 8 decimals
    
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
