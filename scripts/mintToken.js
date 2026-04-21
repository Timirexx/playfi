import { Client, PrivateKey, TokenCreateTransaction, TokenType } from "@hashgraph/sdk";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Ensure the required environment variables are set
if (!process.env.OPERATOR_ID || !process.env.OPERATOR_KEY) {
    throw new Error("Must set OPERATOR_ID and OPERATOR_KEY in .env");
}

const operatorId = process.env.OPERATOR_ID;
// Handle cases where the private key might have a 0x prefix
const cleanKey = process.env.OPERATOR_KEY.startsWith('0x') ? process.env.OPERATOR_KEY.substring(2) : process.env.OPERATOR_KEY;
const operatorKey = PrivateKey.fromStringECDSA(cleanKey);

// 1. Configure the Hedera Testnet Client
// This client facilitates all communication with the Hedera network
const client = Client.forTestnet().setOperator(operatorId, operatorKey);

async function main() {
    console.log("🚀 Starting HTS Token Minting Process...");

    try {
        // 2. Define the TokenCreateTransaction
        // This transaction builds the ecosystem token on the Hedera Token Service (HTS).
        // It initializes the supply and assigns the operator as the treasury.
        let tokenCreateTx = await new TokenCreateTransaction()
            .setTokenName("PlayFi Token")
            .setTokenSymbol("PLAY")
            .setTokenType(TokenType.FungibleCommon)
            .setDecimals(8)
            .setInitialSupply(10000000) // Initial supply of 10,000,000
            .setTreasuryAccountId(operatorId)
            .setSupplyKey(operatorKey)
            .setAdminKey(operatorKey)
            .freezeWith(client);

        // 3. Sign the transaction with the treasury/operator key
        let tokenCreateSign = await tokenCreateTx.sign(operatorKey);

        // 4. Submit the transaction to the Hedera testnet
        console.log("⏳ Submitting transaction to Hedera Testnet...");
        let tokenCreateSubmit = await tokenCreateSign.execute(client);

        // 5. Get the transaction receipt to verify success
        let tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
        let tokenId = tokenCreateRx.tokenId;

        console.log(`\n✅ Success! PlayFi Token (PLAY) created.`);
        console.log(`🪙  Token ID: ${tokenId}`);
        
        // Output the Hashscan explorer link so the grant reviewers can verify the transaction
        console.log(`🌐 Verification Link: https://hashscan.io/testnet/token/${tokenId}`);
        
    } catch (error) {
        console.error("❌ Failed to create token:", error);
    }

    process.exit();
}

main();
