// scripts/testDeposit.js
import fs from "fs";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(process.env.TESTNET_PRIVATE_KEY, provider);

    const vaultAddress = "0x5f960e578e12c1AA6222Ea0E84720cfdbE24E2e8";
    const vaultArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/PlayFiVault.sol/PlayFiVault.json", "utf8"));
    const vault = new ethers.Contract(vaultAddress, vaultArtifact.abi, wallet);

    console.log("Testing deposit of 1 HBAR...");
    try {
        const tx = await vault.deposit({ value: ethers.parseEther("1"), gasLimit: 500000 });
        const receipt = await tx.wait();
        console.log("Deposit successful!", receipt.hash);
    } catch (e) {
        console.error("Deposit failed:");
        console.error(e);
    }
}

main();
