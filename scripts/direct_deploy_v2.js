import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const rpcUrl = "https://testnet.hashio.io/api";
  const privateKey = process.env.TESTNET_PRIVATE_KEY;

  if (!privateKey) {
    console.error("Missing TESTNET_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying from:", wallet.address);

  const contractData = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../src/contracts/PlayFiLeaderboard.json"), "utf8")
  );

  const abi = contractData.abi;
  const bytecode = contractData.evm.bytecode.object;

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  console.log("Sending deployment transaction...");
  const contract = await factory.deploy({
    gasLimit: 3000000
  });

  console.log("Waiting for confirmation...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ PlayFiLeaderboard deployed to:", address);
}

main().catch(console.error);
