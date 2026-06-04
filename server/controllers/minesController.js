import { ethers } from "ethers";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const activeGames = new Map();

/**
 * 16-Box Star Hunt Logic (4x4 Grid)
 */
const TOTAL_TILES = 16;

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
    const { userAddress, betAmount, minesCount, clientSeed } = req.body;
    if (!userAddress || !betAmount || !minesCount) return res.status(400).json({ success: false, error: "Missing parameters" });

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
        const gamesAddress = "0x498a44C73397940733a9732512fA13069Bc";
        const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
        const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
        const abi = ["function settleResult(address user, uint256 winAmount, uint256 lossAmount) public"];
        const contract = new ethers.Contract(gamesAddress, abi, wallet);

        const winTiny = ethers.parseUnits(winAmount.toFixed(8), 8);
        const lossTiny = ethers.parseUnits(parseFloat(betAmount).toFixed(8), 8);

        const tx = await contract.settleResult(userAddress, winTiny, lossTiny);
        await tx.wait();
    } catch (err) {
        console.error("[MINES] Settlement Error:", err.message);
    }
}
