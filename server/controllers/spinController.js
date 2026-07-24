import { 
    Client, 
    AccountId, 
    PrivateKey, 
    TransferTransaction, 
    Hbar 
} from "@hashgraph/sdk";
import { ethers } from "ethers";
import axios from "axios";
import dotenv from "dotenv";
import { PLAYFI_HUB_ADDRESS, PLAYFI_HUB_ABI, GAME_ID } from "../config/playFiGameHub.js";

dotenv.config();

// Configuration
const TREASURY_ID = AccountId.fromString(process.env.TREASURY_ACCOUNT_ID);
const TREASURY_KEY = PrivateKey.fromString(process.env.TREASURY_PRIVATE_KEY);

// Initialize Hedera Client
const client = Client.forTestnet().setOperator(TREASURY_ID, TREASURY_KEY);

// Visual Wheel Mapping (36 slices)
const WHEEL_LAYOUT = [
    '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', '1x', '2x', '1x', '4x', 
    '1x', '2x', '1x', '10x', '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', 
    '1x', '2x', '1x', '4x', '1x', '2x', '1x', '20x', '1x', '2x', '1x', '40x'
];

// Idempotency Cache (In-memory)
const processedTransactions = new Set();

/**
 * Weighted RNG Logic (Strict 100% sum)
 */
const getLandedMultiplier = () => {
    const weight = Math.random() * 100;
    if (weight <= 55.0) return "1x";
    if (weight <= 90.0) return "2x";
    if (weight <= 97.0) return "4x";
    if (weight <= 99.0) return "5x";
    if (weight <= 99.6) return "10x";
    if (weight <= 99.9) return "20x";
    return "40x";
};

export const handleSpin = async (req, res) => {
    const { transactionId, userAddress, betAmount, prediction } = req.body;

    console.log(`[SPIN] Request from ${userAddress} | Tx: ${transactionId} | Prediction: ${prediction}`);

    try {
        // 1. IDEMPOTENCY CHECK
        if (processedTransactions.has(transactionId)) {
            return res.status(400).json({ success: false, error: "Transaction already processed." });
        }

        // 2. TRANSACTION VERIFICATION (EVM Hash via ethers)
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

        const expectedAddress = PLAYFI_HUB_ADDRESS.toLowerCase();
        if (!txResponse.to || txResponse.to.toLowerCase() !== expectedAddress) {
            return res.status(400).json({ success: false, error: "Incorrect payment recipient." });
        }

        const expectedWei = ethers.parseUnits(betAmount.toString(), 18);
        if (txResponse.value < expectedWei) {
            return res.status(400).json({ success: false, error: "Incorrect payment amount." });
        }

        // Mark as processed
        processedTransactions.add(transactionId);

        // 3. GENERATE RESULT
        const landedMultiplier = getLandedMultiplier();
        const isWin = (landedMultiplier === prediction);
        
        // 4. VISUAL MAPPING
        const matchingIndices = WHEEL_LAYOUT.reduce((acc, val, idx) => {
            if (val === landedMultiplier) acc.push(idx);
            return acc;
        }, []);
        const targetIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

        // 5. CONTRACT SETTLEMENT
        let payoutTransactionId = null;
        try {
            const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
            const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
            const hub = new ethers.Contract(PLAYFI_HUB_ADDRESS, PLAYFI_HUB_ABI, wallet);

            const multiplierValue = parseInt(landedMultiplier.replace("x", ""));
            // winAmount = bet * multiplier, in 18-decimal weibars to match the bet. 0 = loss.
            const winWei = isWin ? ethers.parseUnits((parseFloat(betAmount) * multiplierValue).toString(), 18) : 0n;

            // Fire and forget: if winWei > 0, it pays out. If 0, it just emits the event.
            hub.settleBet(userAddress, GAME_ID.SPIN, winWei, { gasLimit: 600000 })
                .then(tx => tx.wait().catch(err => console.error("Settlement Confirm Error:", err)))
                .catch(err => console.error("Settlement Submit Error:", err));

        } catch (contractErr) {
            console.error("[SPIN] Contract Settlement Error:", contractErr.message);
        }

        // 6. RESPONSE
        return res.json({
            success: true,
            landedMultiplier,
            isWin,
            targetIndex,
            payoutTransactionId
        });

    } catch (error) {
        console.error("Spin Error:", error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            error: "Backend processing error. Please check your transaction status." 
        });
    }
};
