import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("🚀 Starting Standalone GameTreasury Deployment...");

    const privateKey = process.env.TREASURY_PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    const rpcUrl = "https://testnet.hashio.io/api";

    if (!privateKey) throw new Error("TREASURY_PRIVATE_KEY is missing in .env");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // 1. Read and Compile Contract
    const contractPath = path.resolve("contracts", "GameTreasury.sol");
    const source = fs.readFileSync(contractPath, "utf8");

    const input = {
        language: "Solidity",
        sources: {
            "GameTreasury.sol": { content: source },
        },
        settings: {
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode"],
                },
            },
        },
    };

    console.log("📦 Compiling GameTreasury.sol...");
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        output.errors.forEach((err) => console.error(err.formattedMessage));
        if (output.errors.some(e => e.severity === 'error')) throw new Error("Compilation failed");
    }

    const contractData = output.contracts["GameTreasury.sol"]["GameTreasury"];
    const abi = contractData.abi;
    const bytecode = contractData.evm.bytecode.object;

    // 2. Deploy
    console.log("⏳ Deploying to Hedera Testnet via Hashio...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy({ gasLimit: 5000000 });

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ SUCCESS!");
    console.log(`🏰 GameTreasury Address: ${address}`);
    console.log(`🌐 Hashscan: https://hashscan.io/testnet/contract/${address}`);
    
    // Save ABI to src/contracts/GameTreasury.js
    const abiString = JSON.stringify(abi, null, 2);
    const jsContent = `export const GAME_TREASURY_ADDRESS = "${address}";\nexport const GAME_TREASURY_ABI = ${abiString};\n`;
    fs.writeFileSync(path.resolve("src", "contracts", "GameTreasury.js"), jsContent);
    console.log("💾 Saved GameTreasury.js to src/contracts/");
    
    // Fund it
    console.log("💰 Funding GameTreasury with 1000 HBAR...");
    const tx = await contract.fundHouse({ value: ethers.parseUnits("1000", 8), gasLimit: 500000 });
    await tx.wait();
    console.log("✅ Funded GameTreasury!");
}

main().catch(console.error);
