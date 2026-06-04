import { 
    Client, 
    AccountId, 
    PrivateKey, 
    TransferTransaction, 
    Hbar 
} from "@hashgraph/sdk";
import axios from "axios";

// Configuration
const TREASURY_ID = AccountId.fromString(process.env.TREASURY_ACCOUNT_ID);
const TREASURY_KEY = PrivateKey.fromString(process.env.TREASURY_PRIVATE_KEY);

// Initialize Hedera Client
const client = Client.forTestnet().setOperator(TREASURY_ID, TREASURY_KEY);

const WHEEL_LAYOUT = [
    '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', '1x', '2x', '1x', '4x', 
    '1x', '2x', '1x', '10x', '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', 
    '1x', '2x', '1x', '4x', '1x', '2x', '1x', '20x', '1x', '2x', '1x', '40x'
];

const processedTransactions = new Set(); // Note: In serverless, this will reset frequently. Use a DB for production.

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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { transactionId, userAddress, prediction } = req.body;

    try {
        // 1. TRANSACTION VERIFICATION
        const formattedId = transactionId.replace("@", "-").replace(".", "-");
        const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${formattedId}`;
        
        const response = await axios.get(mirrorNodeUrl);
        const txData = response.data.transactions[0];

        if (!txData || txData.result !== "SUCCESS") {
            return res.status(400).json({ success: false, error: "Invalid transaction." });
        }

        const treasuryTransfer = txData.transfers.find(
            t => t.account === process.env.TREASURY_ACCOUNT_ID && t.amount === 100000000
        );

        if (!treasuryTransfer) {
            return res.status(400).json({ success: false, error: "Incorrect payment." });
        }

        const landedMultiplier = getLandedMultiplier();
        const isWin = (landedMultiplier === prediction);
        
        const matchingIndices = WHEEL_LAYOUT.reduce((acc, val, idx) => {
            if (val === landedMultiplier) acc.push(idx);
            return acc;
        }, []);
        const targetIndex = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

        let payoutTransactionId = null;
        if (isWin) {
            const multiplierValue = parseInt(landedMultiplier.replace("x", ""));
            const payoutAmount = new Hbar(multiplierValue);

            const payoutTx = await new TransferTransaction()
                .addHbarTransfer(TREASURY_ID, payoutAmount.negated())
                .addHbarTransfer(userAddress, payoutAmount)
                .execute(client);

            const receipt = await payoutTx.getReceipt(client);
            if (receipt.status.toString() === "SUCCESS") {
                payoutTransactionId = payoutTx.transactionId.toString();
            }
        }

        return res.status(200).json({
            success: true,
            landedMultiplier,
            isWin,
            targetIndex,
            payoutTransactionId
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
