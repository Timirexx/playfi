import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function fund() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
    const abi = ["function fundHouse() public payable"];
    const contract = new ethers.Contract("0xAc7829fE9997C5112CA88C1f743948767f8814C1", abi, wallet);
    
    console.log("Funding vault with 1000 HBAR...");
    const tx = await contract.fundHouse({ value: ethers.parseUnits("1000", 8), gasLimit: 500000 });
    await tx.wait();
    console.log("Funded 1000 HBAR!");
}

fund().catch(console.error);
