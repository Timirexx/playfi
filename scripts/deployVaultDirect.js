import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * STANDALONE HEDERA DEPLOYER
 * This script bypasses Hardhat to ensure deployment works in ESM environments
 */
async function main() {
    console.log("🚀 Starting Standalone PlayFiVault Deployment...");

    const privateKey = process.env.TESTNET_PRIVATE_KEY;
    const rpcUrl = "https://testnet.hashio.io/api";

    if (!privateKey) throw new Error("TESTNET_PRIVATE_KEY is missing in .env");

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
    const contract = await factory.deploy();

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ SUCCESS!");
    console.log(`🏰 Contract Address: ${address}`);
    console.log(`🌐 Hashscan: https://hashscan.io/testnet/contract/${address}`);
}

main().catch(console.error);
