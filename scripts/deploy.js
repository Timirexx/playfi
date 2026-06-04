import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const RPC_URL = "https://testnet.hashio.io/api";
const PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY; // Use the key we already have

if (!PRIVATE_KEY) {
    console.error("TREASURY_PRIVATE_KEY not found in .env");
    process.exit(1);
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`Deploying from: ${wallet.address}`);

    const artifactPath = path.resolve('artifacts', 'PlayFiVault.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet);

    console.log("Deploying PlayFiVault...");
    const contract = await factory.deploy();

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`PlayFiVault deployed to: ${address}`);

    // Fund the house with 0.1 HBAR
    console.log("Funding house liquidity...");
    const fundTx = await contract.fundHouse({ value: ethers.parseEther("0.1") });
    await fundTx.wait();
    console.log("House funded successfully.");

    // Save address to a file for backend use
    fs.writeFileSync(path.resolve('artifacts', 'contract_address.txt'), address);
}

main().catch(console.error);
