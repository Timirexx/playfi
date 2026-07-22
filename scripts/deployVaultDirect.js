import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * STANDALONE HEDERA DEPLOYER
 * This script bypasses Hardhat to ensure deployment works in ESM environments.
 *
 * PlayFiVault is the single unified treasury for the whole platform (Staking Vault,
 * Mines, Spin to Win, Two Doors). Deploying it writes the new address + ABI back to
 * src/contracts/PlayFiVault.js and server/config/treasury.js so every consumer stays
 * in sync, then seeds house liquidity so games can pay out immediately.
 */
async function main() {
    console.log("🚀 Starting Standalone PlayFiVault Deployment...");

    const privateKey = process.env.TREASURY_PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    const rpcUrl = "https://testnet.hashio.io/api";

    if (!privateKey) throw new Error("TREASURY_PRIVATE_KEY is missing in .env");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // 1. Read and Compile Contract
    const contractPath = path.resolve("contracts", "PlayFiVault.sol");
    const source = fs.readFileSync(contractPath, "utf8");

    const input = {
        language: "Solidity",
        sources: {
            "PlayFiVault.sol": { content: source },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode"],
                },
            },
        },
    };

    console.log("📦 Compiling PlayFiVault.sol...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        output.errors.forEach((err) => console.error(err.formattedMessage));
        if (output.errors.some(e => e.severity === 'error')) throw new Error("Compilation failed");
    }

    const contractData = output.contracts["PlayFiVault.sol"]["PlayFiVault"];
    const abi = contractData.abi;
    const bytecode = contractData.evm.bytecode.object;

    // 2. Deploy
    console.log("⏳ Deploying to Hedera Testnet via Hashio...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy({ gasLimit: 5000000 });

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ SUCCESS!");
    console.log(`🏰 Contract Address: ${address}`);
    console.log(`🌐 Hashscan: https://hashscan.io/testnet/contract/${address}`);

    // 3. Write the new address + ABI back to the frontend config
    console.log("\n✍️ Updating src/contracts/PlayFiVault.js...");
    const abiString = JSON.stringify(abi, null, 2);
    const frontendConfig = `// Single unified treasury for the whole platform: Staking Vault, Mines, Spin to Win, Two Doors.\nexport const PLAYFI_VAULT_ADDRESS = "${address}";\nexport const PLAYFI_VAULT_ABI = ${abiString};\n`;
    fs.writeFileSync(path.resolve("src", "contracts", "PlayFiVault.js"), frontendConfig);
    console.log("💾 Saved src/contracts/PlayFiVault.js");

    // 4. Write the new address back to the backend treasury config
    console.log("✍️ Updating server/config/treasury.js...");
    const serverConfig = `// Single unified treasury contract (PlayFiVault) powering the Staking Vault,\n// Mines, Spin to Win, and Two Doors. Keep in sync with src/contracts/PlayFiVault.js.\nexport const TREASURY_ADDRESS = "${address}";\n\nexport const TREASURY_SETTLE_ABI = [\n    "function settleGame(address user, uint256 winAmount) public"\n];\n`;
    fs.writeFileSync(path.resolve("server", "config", "treasury.js"), serverConfig);
    console.log("💾 Saved server/config/treasury.js");

    // 5. Seed house liquidity so games can pay out immediately
    console.log("\n🏦 Funding House Liquidity with 1000 HBAR...");
    const fundTx = await contract.fundHouse({ value: ethers.parseUnits("1000", 8), gasLimit: 500000 });
    await fundTx.wait();
    console.log("✅ House liquidity funded!");

    console.log("\n🎉 Unified treasury deployment complete.");
    console.log(`🏰 New Treasury: ${address}`);
}

main().catch(console.error);
