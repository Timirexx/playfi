import { ethers } from "ethers";
import crypto from "crypto";
import dotenv from "dotenv";
import { TREASURY_ADDRESS, TREASURY_SETTLE_ABI } from "../config/treasury.js";

dotenv.config();

const activeGames = new Map();

/**
 * 30-Box Star Hunt Logic (6x5 Grid)
 */
const TOTAL_TILES = 30;

const calculateMultiplier = (mines, revealed) => {
    if (revealed === 0) return 1.0;
    
    const factorial = (n) => {
        let res = 1n;
        for (let i = 2n; i <= BigInt(n); i++) res *= i;
        return res;
    };

    const nCr = (n, r) => {
        if (r < 0 || r > n) return 0n;
        return factorial(n) / (factorial(r) * factorial(n - r));
    };

    const combinationsTotal = nCr(TOTAL_TILES, revealed);
    const combinationsSafe = nCr(TOTAL_TILES - mines, revealed);
    
    // House Edge: 1% (0.99)
    return 0.99 * (Number(combinationsTotal) / Number(combinationsSafe));
};

export const startMines = async (req, res) => {
    const { transactionId, userAddress, betAmount, minesCount, clientSeed } = req.body;
    if (!transactionId || !userAddress || !betAmount || !minesCount) return res.status(400).json({ success: false, error: "Missing parameters" });

    try {
        // Verify EVM Transaction
        const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
        
        let txReceipt = null;
        let txResponse = null;
        let attempts = 0;
        
        // Retry loop to handle RPC indexing delay
        while (attempts < 10) {
            txReceipt = await provider.getTransactionReceipt(transactionId);
            txResponse = await provider.getTransaction(transactionId);
            
            if (txReceipt && txReceipt.status === 1 && txResponse) {
                break; // Found and successful
            }
            
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s before retry
        }

        if (!txReceipt || txReceipt.status !== 1 || !txResponse) {
            return res.status(400).json({ success: false, error: "Transaction failed or not found after retries." });
        }

        const expectedAddress = TREASURY_ADDRESS.toLowerCase();
        if (!txResponse.to || txResponse.to.toLowerCase() !== expectedAddress) {
            return res.status(400).json({ success: false, error: "Incorrect payment recipient." });
        }

        const expectedWei = ethers.parseUnits(betAmount.toString(), 18);
        if (txResponse.value < expectedWei) {
            return res.status(400).json({ success: false, error: "Incorrect payment amount." });
        }
    } catch (error) {
        console.error("Mines TX Verification Error:", error);
        return res.status(400).json({ success: false, error: "Transaction verification failed." });
    }

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const nonce = (activeGames.get(userAddress)?.nonce || 0) + 1;

    // Generate 4x4 Grid (16 Tiles)
    const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
    let indices = Array.from({ length: TOTAL_TILES }, (_, i) => i);
    let seedInt = parseInt(hash.slice(0, 8), 16);
    
    for (let i = indices.length - 1; i > 0; i--) {
        const j = seedInt % (i + 1);
        [indices[i], indices[j]] = [indices[j], indices[i]];
        seedInt = Math.floor(seedInt / 2) + (i * 123);
    }

    const mines = new Set(indices.slice(0, minesCount));
    const grid = Array(TOTAL_TILES).fill(false).map((_, i) => mines.has(i));

    activeGames.set(userAddress, {
        grid,
        minesCount,
        betAmount,
        revealed: new Set(),
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        active: true
    });

    res.json({ success: true, serverSeedHash, nonce, starBonus: 10 });
};

export const revealTile = async (req, res) => {
    const { userAddress, tileIndex } = req.body;
    const game = activeGames.get(userAddress);

    if (!game || !game.active) return res.status(400).json({ success: false, error: "No active game" });
    if (game.revealed.has(tileIndex)) return res.status(400).json({ success: false, error: "Already opened" });

    if (game.grid[tileIndex]) {
        game.active = false;
        await settleVault(userAddress, 0, game.betAmount);
        return res.json({ success: true, status: 'bomb', grid: game.grid });
    }

    game.revealed.add(tileIndex);
    const currentMultiplier = calculateMultiplier(game.minesCount, game.revealed.size);

    if (game.revealed.size === (TOTAL_TILES - game.minesCount)) {
        game.active = false;
        const winAmount = parseFloat(game.betAmount) * currentMultiplier;
        await settleVault(userAddress, winAmount, game.betAmount);
        return res.json({ success: true, status: 'victory', multiplier: currentMultiplier, winAmount, grid: game.grid });
    }

    res.json({ success: true, status: 'star', multiplier: currentMultiplier });
};

export const cashoutMines = async (req, res) => {
    const { userAddress } = req.body;
    const game = activeGames.get(userAddress);

    if (!game || !game.active || game.revealed.size === 0) {
        return res.status(400).json({ success: false, error: "Cannot claim reward" });
    }

    const multiplier = calculateMultiplier(game.minesCount, game.revealed.size);
    const winAmount = parseFloat(game.betAmount) * multiplier;

    game.active = false;
    await settleVault(userAddress, winAmount, game.betAmount);

    res.json({ success: true, winAmount, multiplier, grid: game.grid });
};

async function settleVault(userAddress, winAmount, betAmount) {
    try {
        const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
        const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(TREASURY_ADDRESS, TREASURY_SETTLE_ABI, wallet);

        const winTiny = ethers.parseUnits(winAmount.toFixed(8), 8);

        // Add gasLimit to avoid Hashio INSUFFICIENT_TX_FEE error
        const tx = await contract.settleGame(userAddress, winTiny, { gasLimit: 500000 });
        
        // Fire and forget the confirmation wait so the frontend gets an instant response
        tx.wait().catch(err => console.error("[MINES] Settlement Confirmation Error:", err.message));
    } catch (err) {
        console.error("[MINES] Settlement Submission Error:", err.message);
        // Swallow error to prevent HTTP 500. The user lost/won visually, 
        // the blockchain will be corrected if needed, but the game must continue instantly.
    }
}
