import { ethers } from "ethers";
import dotenv from "dotenv";
import { PLAYFI_VAULT_ADDRESS } from "../src/contracts/PlayFiVault.js";

dotenv.config();

async function fund() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
    const abi = ["function fundHouse() public payable"];
    const contract = new ethers.Contract(PLAYFI_VAULT_ADDRESS, abi, wallet);

    console.log("Funding vault with 1000 HBAR...");
    const tx = await contract.fundHouse({ value: ethers.parseUnits("1000", 8), gasLimit: 500000 });
    await tx.wait();
    console.log("Funded 1000 HBAR!");
}

fund().catch(console.error);
