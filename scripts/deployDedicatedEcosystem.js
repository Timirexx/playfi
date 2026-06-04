import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("🚀 Starting Dedicated PlayFi Treasury & Game Deployment...");

    const privateKey = process.env.TREASURY_PRIVATE_KEY;
    const rpcUrl = "https://testnet.hashio.io/api";

    if (!privateKey) {
        throw new Error("TREASURY_PRIVATE_KEY is missing in .env");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`🤖 Deploying from account EVM Address: ${wallet.address}`);
    
    const balanceBefore = await provider.getBalance(wallet.address);
    console.log(`📊 Initial Balance: ${ethers.formatEther(balanceBefore)} HBAR`);

    // 1. Read Artifacts
    const vaultArtifactPath = path.resolve(__dirname, "../artifacts/contracts/PlayFiVault.sol/PlayFiVault.json");
    const gamesArtifactPath = path.resolve(__dirname, "../artifacts/contracts/PlayFiGames.sol/PlayFiGames.json");

    if (!fs.existsSync(vaultArtifactPath) || !fs.existsSync(gamesArtifactPath)) {
        throw new Error("Missing contract compilation artifacts! Run 'npx hardhat compile --config hardhat.config.cjs' first.");
    }

    const vaultArtifact = JSON.parse(fs.readFileSync(vaultArtifactPath, "utf8"));
    const gamesArtifact = JSON.parse(fs.readFileSync(gamesArtifactPath, "utf8"));

    // 2. Deploy PlayFiVault (Treasury)
    console.log("\n🏰 Deploying PlayFiVault (Dedicated Treasury)...");
    const vaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
    const vaultContract = await vaultFactory.deploy({ gasLimit: 3000000 });
    await vaultContract.waitForDeployment();
    const vaultAddress = await vaultContract.getAddress();
    console.log(`✅ Dedicated PlayFiVault Deployed to: ${vaultAddress}`);

    // Wait a brief moment to ensure node syncs
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 3. Deploy PlayFiGames (Game Logic)
    console.log("\n🎮 Deploying PlayFiGames (Game Logic)...");
    console.log(`🔗 Linking to Vault Treasury at: ${vaultAddress}`);
    const gamesFactory = new ethers.ContractFactory(gamesArtifact.abi, gamesArtifact.bytecode, wallet);
    const gamesContract = await gamesFactory.deploy(vaultAddress, { gasLimit: 3000000 });
    await gamesContract.waitForDeployment();
    const gamesAddress = await gamesContract.getAddress();
    console.log(`✅ Dedicated PlayFiGames Deployed to: ${gamesAddress}`);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 4. Authorize Game Logic inside the Treasury Vault
    console.log("\n🔐 Authorizing PlayFiGames in PlayFiVault...");
    const authTx = await vaultContract.setGameAuthorization(gamesAddress, true, { gasLimit: 1000000 });
    await authTx.wait();
    console.log("✅ PlayFiGames is successfully authorized in the Vault!");

    // 5. Fund the House treasury with 10 HBAR for initial testing
    console.log("\n🏦 Funding Treasury House Liquidity with 10 HBAR...");
    const fundTx = await vaultContract.fundHouse({ value: ethers.parseEther("10"), gasLimit: 1000000 });
    await fundTx.wait();
    console.log("✅ House liquidity successfully funded with 10 HBAR!");

    // 6. Write address mapping back to frontend config files
    console.log("\n✍️ Updating frontend configuration files...");

    const vaultConfigPath = path.resolve(__dirname, "../src/contracts/PlayFiVault.js");
    const gamesConfigPath = path.resolve(__dirname, "../src/contracts/PlayFiGames.js");

    const vaultConfigContent = `export const PLAYFI_VAULT_ADDRESS = "${vaultAddress}";
export const PLAYFI_VAULT_ABI = [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function userBalances(address) public view returns (uint256)",
    "function settleGame(address user, uint256 winAmount, uint256 lossAmount) public",
    "event Deposited(address indexed user, uint256 amount)",
    "event Withdrawn(address indexed user, uint256 amount)"
];
`;

    const gamesConfigContent = `export const PLAYFI_GAMES_ADDRESS = "${gamesAddress}";
export const PLAYFI_GAMES_ABI = [
    "function startMines(uint256 minesCount, uint256 amount) public",
    "function revealTile(uint256 tileIndex) public",
    "function cashoutMines() public",
    "function playSpin(uint256 amount) public",
    "event SpinPlayed(address indexed user, uint256 bet, uint256 multiplier, uint256 winAmount)",
    "event MinesStarted(address indexed user, uint256 bet, uint256 minesCount)",
    "event MinesRevealed(address indexed user, uint256 tileIndex, bool isMine)",
    "event MinesCashout(address indexed user, uint256 payout)"
];
`;

    fs.writeFileSync(vaultConfigPath, vaultConfigContent);
    console.log(`📝 Updated ${vaultConfigPath}`);

    fs.writeFileSync(gamesConfigPath, gamesConfigContent);
    console.log(`📝 Updated ${gamesConfigPath}`);

    // Update artifacts/contract_address.txt for other backend/cli references
    fs.writeFileSync(path.resolve(__dirname, "../artifacts/contract_address.txt"), vaultAddress);

    const balanceAfter = await provider.getBalance(wallet.address);
    console.log(`\n📊 Final Balance: ${ethers.formatEther(balanceAfter)} HBAR`);
    console.log(`⛽ Total Gas/Execution Cost: ${ethers.formatEther(balanceBefore - balanceAfter)} HBAR`);

    console.log("\n🎉 ALL STEPS COMPLETED SUCCESSFULY!");
    console.log(`🏰 New Treasury: ${vaultAddress}`);
    console.log(`🎮 New Game Logic: ${gamesAddress}`);
}

main().catch((error) => {
    console.error("\n❌ Deployment Failed:", error);
    process.exit(1);
});
