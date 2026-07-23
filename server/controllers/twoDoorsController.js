import { ethers } from "ethers";
import dotenv from "dotenv";
import { TWO_DOORS_ADDRESS, TWO_DOORS_SETTLE_ABI } from "../config/twoDoors.js";

dotenv.config();

const HASHIO_RPC = "https://testnet.hashio.io/api";

// Idempotency cache (in-memory) so the same stake tx can't be settled twice.
const processedTransactions = new Set();

/**
 * Two Doors resolution.
 *
 * Flow: the player has already staked on-chain via placeBet() (their HBAR is in
 * the treasury). This endpoint verifies that stake transaction, decides the
 * 50/50 outcome server-side, and pays 2x to winners via settleGame().
 */
export const handleTwoDoors = async (req, res) => {
    const { transactionId, userAddress, betAmount, selectedDoor } = req.body;

    console.log(`[TWO DOORS] Request from ${userAddress} | Tx: ${transactionId} | Door: ${selectedDoor}`);

    if (!transactionId || !userAddress || !betAmount || !selectedDoor) {
        return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    try {
        // 1. IDEMPOTENCY CHECK
        if (processedTransactions.has(transactionId)) {
            return res.status(400).json({ success: false, error: "Transaction already processed." });
        }

        // 2. VERIFY THE STAKE TRANSACTION (recipient + amount) with RPC retry
        const provider = new ethers.JsonRpcProvider(HASHIO_RPC);

        let txReceipt = null;
        let txResponse = null;
        let attempts = 0;
        while (attempts < 10) {
            txReceipt = await provider.getTransactionReceipt(transactionId);
            txResponse = await provider.getTransaction(transactionId);
            if (txReceipt && txReceipt.status === 1 && txResponse) break;
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        if (!txReceipt || txReceipt.status !== 1 || !txResponse) {
            return res.status(400).json({ success: false, error: "Transaction failed or not found after retries." });
        }

        if (!txResponse.to || txResponse.to.toLowerCase() !== TWO_DOORS_ADDRESS.toLowerCase()) {
            return res.status(400).json({ success: false, error: "Incorrect payment recipient." });
        }

        const expectedWei = ethers.parseUnits(betAmount.toString(), 18);
        if (txResponse.value < expectedWei) {
            return res.status(400).json({ success: false, error: "Incorrect payment amount." });
        }

        // Mark as processed
        processedTransactions.add(transactionId);

        // 3. DECIDE OUTCOME (treasure behind door 1 or 2, 50/50)
        const treasureDoor = Math.random() < 0.5 ? 1 : 2;
        const isWin = parseInt(selectedDoor) === treasureDoor;

        // 4. SETTLE — pay 2x to winners; losers' stake stays in the treasury.
        let payoutTransactionId = null;
        try {
            const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
            const contract = new ethers.Contract(TWO_DOORS_ADDRESS, TWO_DOORS_SETTLE_ABI, wallet);

            const winTiny = isWin ? ethers.parseUnits((parseFloat(betAmount) * 2).toFixed(8), 8) : 0n;

            // Fire and forget: pays out if winTiny > 0, otherwise just emits the event.
            contract.settleGame(userAddress, winTiny, { gasLimit: 500000 })
                .then((tx) => {
                    payoutTransactionId = tx.hash;
                    return tx.wait().catch((err) => console.error("[TWO DOORS] Settlement confirm error:", err.message));
                })
                .catch((err) => console.error("[TWO DOORS] Settlement submit error:", err.message));
        } catch (contractErr) {
            console.error("[TWO DOORS] Contract settlement error:", contractErr.message);
        }

        // 5. RESPONSE
        return res.json({ success: true, isWin, treasureDoor, payoutTransactionId });
    } catch (error) {
        console.error("Two Doors Error:", error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            error: "Backend processing error. Please check your transaction status.",
        });
    }
};
