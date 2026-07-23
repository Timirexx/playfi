import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * STANDALONE HEDERA GAME DEPLOYER
 *
 * Deploys one of the independent per-game treasury contracts (Mines, SpinToWin,
 * TwoDoors) to Hedera testnet, then writes its address + ABI into the matching
 * frontend config file (src/contracts/<Game>.js) so the dApp can talk to it.
 *
 * Each game is fully independent — deploying or redeploying one does NOT touch
 * the others. Run it once per game:
 *
 *   node scripts/deployGame.js Mines
 *   node scripts/deployGame.js SpinToWin
 *   node scripts/deployGame.js TwoDoors
 *
 * Required in .env:
 *   TREASURY_PRIVATE_KEY   - deployer key (becomes the contract owner); needs testnet HBAR for gas
 *   BACKEND_SIGNER_ADDRESS - (optional) hot wallet the game server uses to resolve rounds.
 *                            Defaults to the deployer address if unset. Rotate later with setBackendSigner().
 *
 * Optional:
 *   FUND_HBAR=1000  - seed this much house liquidity right after deploy (0 or unset = skip)
 */

const GAMES = {
    Mines: {
        file: "Mines.sol",
        constant: "MINES",
        frontendConst: "MINES",
    },
    SpinToWin: {
        file: "SpinToWin.sol",
        constant: "SPIN_TO_WIN",
        frontendConst: "SPIN_TO_WIN",
    },
    TwoDoors: {
        file: "TwoDoors.sol",
        constant: "TWO_DOORS",
        frontendConst: "TWO_DOORS",
    },
};

const GAMES_DIR = path.resolve("contracts", "games");

/**
 * solc import resolver: pulls in @openzeppelin/* from node_modules and the
 * sibling GameBase.sol from contracts/games/.
 */
function findImport(importPath) {
    let resolved;
    if (importPath.startsWith("@openzeppelin/")) {
        resolved = path.resolve("node_modules", importPath);
    } else {
        // relative import like "./GameBase.sol"
        resolved = path.resolve(GAMES_DIR, importPath);
    }
    if (fs.existsSync(resolved)) {
        return { contents: fs.readFileSync(resolved, "utf8") };
    }
    return { error: `File not found: ${importPath}` };
}

function compileGame(gameName) {
    const cfg = GAMES[gameName];
    const entry = cfg.file;

    // Provide the entry contract plus its local dependency; OZ + GameBase are
    // pulled in on demand through findImport.
    const sources = {
        [entry]: { content: fs.readFileSync(path.join(GAMES_DIR, entry), "utf8") },
        "GameBase.sol": { content: fs.readFileSync(path.join(GAMES_DIR, "GameBase.sol"), "utf8") },
    };

    const input = {
        language: "Solidity",
        sources,
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
        },
    };

    console.log(`📦 Compiling ${entry} (with OpenZeppelin + GameBase)...`);
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

    if (output.errors) {
        let fatal = false;
        for (const err of output.errors) {
            console.error(err.formattedMessage);
            if (err.severity === "error") fatal = true;
        }
        if (fatal) throw new Error("Compilation failed");
    }

    const contractData = output.contracts[entry][gameName];
    if (!contractData) throw new Error(`Compiled output missing contract ${gameName}`);
    return { abi: contractData.abi, bytecode: contractData.evm.bytecode.object };
}

async function main() {
    const gameName = process.argv[2];
    if (!gameName || !GAMES[gameName]) {
        console.error("Usage: node scripts/deployGame.js <Mines|SpinToWin|TwoDoors>");
        process.exit(1);
    }

    console.log(`🚀 Deploying ${gameName} to Hedera Testnet...\n`);

    const privateKey = process.env.TREASURY_PRIVATE_KEY || process.env.TESTNET_PRIVATE_KEY;
    if (!privateKey) throw new Error("TREASURY_PRIVATE_KEY is missing in .env");

    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const wallet = new ethers.Wallet(privateKey, provider);

    const ownerAddress = wallet.address;
    const backendSigner = process.env.BACKEND_SIGNER_ADDRESS || ownerAddress;
    if (!ethers.isAddress(backendSigner)) {
        throw new Error(`BACKEND_SIGNER_ADDRESS is not a valid address: ${backendSigner}`);
    }

    console.log(`👛 Deployer / owner:  ${ownerAddress}`);
    console.log(`🤖 Backend signer:    ${backendSigner}${backendSigner === ownerAddress ? " (defaulted to deployer)" : ""}\n`);

    const { abi, bytecode } = compileGame(gameName);

    console.log("⏳ Deploying...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    // Constructor: (address initialOwner, address initialBackendSigner)
    const contract = await factory.deploy(ownerAddress, backendSigner, { gasLimit: 5000000 });
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ SUCCESS!");
    console.log(`🎮 ${gameName} Address: ${address}`);
    console.log(`🌐 Hashscan: https://hashscan.io/testnet/contract/${address}`);

    // Write address + ABI to the frontend config for this game only.
    const cfg = GAMES[gameName];
    const outPath = path.resolve("src", "contracts", `${gameName}.js`);
    const abiString = JSON.stringify(abi, null, 2);
    const jsContent =
        `// Independent on-chain treasury for the ${gameName} game. Generated by scripts/deployGame.js.\n` +
        `export const ${cfg.frontendConst}_ADDRESS = "${address}";\n` +
        `export const ${cfg.frontendConst}_ABI = ${abiString};\n`;
    fs.writeFileSync(outPath, jsContent);
    console.log(`\n💾 Saved ${outPath}`);

    // TwoDoors also needs a backend config so the keeper can call resolveGame.
    // Only the address changes on redeploy; the ABI/status enum stay in sync.
    if (gameName === "TwoDoors") {
        const serverPath = path.resolve("server", "config", "twoDoors.js");
        const serverContent =
            `// Two Doors game contract config for the backend keeper. Generated by scripts/deployGame.js.\n` +
            `export const TWO_DOORS_ADDRESS = "${address}";\n` +
            `export const TWO_DOORS_ABI = ${abiString};\n\n` +
            `// Matches TwoDoors.Status in the contract.\n` +
            `export const TWO_DOORS_STATUS = { NONE: 0, STAKED: 1, DOOR_CHOSEN: 2, RESOLVED: 3 };\n`;
        fs.writeFileSync(serverPath, serverContent);
        console.log(`💾 Saved ${serverPath}`);
    }

    // Optionally seed house liquidity so payouts work immediately.
    // NOTE: value is sent in 18-decimal weibars (ethers.parseEther), matching how the
    // frontend sends bet value through Hashio's JSON-RPC.
    const fundHbar = process.env.FUND_HBAR;
    if (fundHbar && Number(fundHbar) > 0) {
        console.log(`\n🏦 Funding house liquidity with ${fundHbar} HBAR...`);
        const fundTx = await contract.fundHouse({ value: ethers.parseEther(fundHbar), gasLimit: 500000 });
        await fundTx.wait();
        console.log("✅ House liquidity funded!");
    } else {
        console.log("\nℹ️  Skipped house funding (set FUND_HBAR=<amount> to seed liquidity).");
        console.log("   The contract cannot pay out wins until it holds HBAR — fund it before going live.");
    }

    console.log(`\n🎉 ${gameName} deployment complete: ${address}`);
}

main().catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
});
