import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Idempotency Cache (In-memory)
const processedTransactions = new Set();

export const handleTwoDoors = async (req, res) => {
    const { transactionId, userAddress, betAmount, selectedDoor } = req.body;

    console.log(`[TWO DOORS] Request from ${userAddress} | Tx: ${transactionId} | Door: ${selectedDoor}`);

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

        const expectedAddress = "0x83F2DAEE3765ffEFdD02812E96d23Bb293ae0EAF".toLowerCase();
        if (!txResponse.to || txResponse.to.toLowerCase() !== expectedAddress) {
            return res.status(400).json({ success: false, error: "Incorrect payment recipient." });
        }

        const expectedWei = ethers.parseUnits(betAmount.toString(), 18);
        if (txResponse.value < expectedWei) {
            return res.status(400).json({ success: false, error: "Incorrect payment amount." });
        }

        // Mark as processed
        processedTransactions.add(transactionId);

        // 3. GENERATE RESULT (1 or 2)
        const treasureDoor = Math.random() < 0.5 ? 1 : 2;
        const isWin = (parseInt(selectedDoor) === treasureDoor);

        // 4. CONTRACT SETTLEMENT
        let payoutTransactionId = null;
        try {
            const gamesAddress = "0x83F2DAEE3765ffEFdD02812E96d23Bb293ae0EAF";
            const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
            const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
            
            const abi = [
                "function settleGame(address user, uint256 winAmount) public"
            ];
            const contract = new ethers.Contract(gamesAddress, abi, wallet);
            
            // Multiply betAmount by 2 if win
            const winTiny = isWin ? ethers.parseUnits((parseFloat(betAmount) * 2).toFixed(8), 8) : 0n;
            
            // Fire and forget: if winTiny > 0, it pays out. If 0, it just emits event.
            contract.settleGame(userAddress, winTiny, { gasLimit: 500000 })
                .then(tx => tx.wait().catch(err => console.error("Settlement Confirm Error:", err)))
                .catch(err => console.error("Settlement Submit Error:", err));

        } catch (contractErr) {
            console.error("[TWO DOORS] Contract Settlement Error:", contractErr.message);
        }

        // 5. RESPONSE
        return res.json({
            success: true,
            isWin,
            treasureDoor,
            payoutTransactionId
        });

    } catch (error) {
        console.error("Two Doors Error:", error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            error: "Backend processing error. Please check your transaction status." 
        });
    }
};
