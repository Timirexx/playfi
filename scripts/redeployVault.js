import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);

    const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/PlayFiVault.sol/PlayFiVault.json"));
    
    console.log("Deploying New PlayFiVault...");
    const Factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const vault = await Factory.deploy();
    await vault.waitForDeployment();
    
    const addr = await vault.getAddress();
    console.log("New Vault Deployed to:", addr);
}

main().catch(console.error);
