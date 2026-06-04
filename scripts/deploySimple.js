import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);

    const vaultAddress = "0x5747599966B2F8a6bF1E4265114cBba2d79CCFA6";
    
    // Read the compiled JSON
    const gamesArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/PlayFiGames.sol/PlayFiGames.json"));
    
    console.log("Deploying PlayFiGames...");
    const GamesFactory = new ethers.ContractFactory(gamesArtifact.abi, gamesArtifact.bytecode, wallet);
    const games = await GamesFactory.deploy(vaultAddress);
    await games.waitForDeployment();
    
    const gamesAddress = await games.getAddress();
    console.log("Deployed to:", gamesAddress);
    
    // Authorize
    console.log("Authorizing in Vault...");
    const vaultAbi = ["function setGameAuthorization(address,bool) public"];
    const vault = new ethers.Contract(vaultAddress, vaultAbi, wallet);
    const tx = await vault.setGameAuthorization(gamesAddress, true);
    await tx.wait();
    console.log("Done!");
}

main().catch(console.error);
