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
    const { transactionId, userAddress, prediction } = req.body;

    console.log(`[SPIN] Request from ${userAddress} | Tx: ${transactionId} | Prediction: ${prediction}`);

    try {
    try {
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
            const vaultAddress = "0x699d083C0516401B1C8Ed1e26A2382D9af9eD911";
            const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
            const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
            
            const abi = [
                "function settleGame(address user, uint256 winAmount, uint256 lossAmount) public"
            ];
            const contract = new ethers.Contract(vaultAddress, abi, wallet);

            const multiplierValue = parseInt(landedMultiplier.replace("x", ""));
            const winAmountTiny = isWin ? ethers.parseUnits(multiplierValue.toString(), 8) : 0;
            const lossAmountTiny = ethers.parseUnits("1", 8); // 1 HBAR bet

            console.log(`[SPIN] Settling contract: Win=${multiplierValue}x | Loss=1x`);
            
            const tx = await contract.settleGame(userAddress, winAmountTiny, lossAmountTiny, { gasLimit: 500000 });
            await tx.wait();
            payoutTransactionId = tx.hash;

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
