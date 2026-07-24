import { ethers } from "ethers";
import dotenv from "dotenv";
import { PLAYFI_HUB_ADDRESS, PLAYFI_HUB_ABI, GAME_ID } from "../config/playFiGameHub.js";

dotenv.config();

const HASHIO_RPC = "https://testnet.hashio.io/api";

// Idempotency cache (in-memory) so the same stake tx can't be settled twice.
const processedTransactions = new Set();

/**
 * Two Doors resolution.
 *
 * The player has already staked via the game hub's placeBet(TWO_DOORS) — their
 * HBAR is in the shared treasury (minus the 5% platform fee). This endpoint
 * verifies that stake, decides the 50/50 outcome, and instructs the hub to pay
 * 2x to winners via settleBet (which pays from the treasury).
 */
export const handleTwoDoors = async (req, res) => {
    const { transactionId, userAddress, betAmount, selectedDoor } = req.body;

    console.log(`[TWO DOORS] ${userAddress} | Tx: ${transactionId} | Door: ${selectedDoor}`);

    if (!transactionId || !userAddress || !betAmount || !selectedDoor) {
        return res.status(400).json({ success: false, error: "Missing parameters" });
    }
    if (PLAYFI_HUB_ADDRESS === "0x0000000000000000000000000000000000000000") {
        return res.status(500).json({ success: false, error: "Game hub not deployed yet." });
    }

    try {
        if (processedTransactions.has(transactionId)) {
            return res.status(400).json({ success: false, error: "Transaction already processed." });
        }

        const provider = new ethers.JsonRpcProvider(HASHIO_RPC);

        // Verify the stake transaction (recipient + amount) with RPC retry.
        let txReceipt = null;
        let txResponse = null;
        let attempts = 0;
        while (attempts < 10) {
            txReceipt = await provider.getTransactionReceipt(transactionId);
            txResponse = await provider.getTransaction(transactionId);
            if (txReceipt && txReceipt.status === 1 && txResponse) break;
            attempts++;
            await new Promise((r) => setTimeout(r, 1500));
        }
        if (!txReceipt || txReceipt.status !== 1 || !txResponse) {
            return res.status(400).json({ success: false, error: "Transaction failed or not found after retries." });
        }
        if (!txResponse.to || txResponse.to.toLowerCase() !== PLAYFI_HUB_ADDRESS.toLowerCase()) {
            return res.status(400).json({ success: false, error: "Incorrect payment recipient." });
        }
        const expectedWei = ethers.parseUnits(betAmount.toString(), 18);
        if (txResponse.value < expectedWei) {
            return res.status(400).json({ success: false, error: "Incorrect payment amount." });
        }

        processedTransactions.add(transactionId);

        // Decide outcome (treasure behind door 1 or 2, 50/50).
        const treasureDoor = Math.random() < 0.5 ? 1 : 2;
        const isWin = parseInt(selectedDoor) === treasureDoor;

        // Settle via the hub. winAmount is in 18-decimal weibars to match the bet.
        let payoutTransactionId = null;
        try {
            const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
            const hub = new ethers.Contract(PLAYFI_HUB_ADDRESS, PLAYFI_HUB_ABI, wallet);
            const winWei = isWin ? ethers.parseUnits((parseFloat(betAmount) * 2).toString(), 18) : 0n;

            hub.settleBet(userAddress, GAME_ID.TWO_DOORS, winWei, { gasLimit: 600000 })
                .then((tx) => {
                    payoutTransactionId = tx.hash;
                    return tx.wait().catch((err) => console.error("[TWO DOORS] Settle confirm error:", err.message));
                })
                .catch((err) => console.error("[TWO DOORS] Settle submit error:", err.message));
        } catch (contractErr) {
            console.error("[TWO DOORS] Settlement error:", contractErr.message);
        }

        return res.json({ success: true, isWin, treasureDoor, payoutTransactionId });
    } catch (error) {
        console.error("Two Doors Error:", error.message);
        return res.status(500).json({ success: false, error: "Backend processing error." });
    }
};
