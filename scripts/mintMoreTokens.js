import { Client, PrivateKey, TokenMintTransaction, TokenId } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

const operatorId = process.env.OPERATOR_ID;
const cleanKey = process.env.OPERATOR_KEY.startsWith('0x') ? process.env.OPERATOR_KEY.substring(2) : process.env.OPERATOR_KEY;
const operatorKey = PrivateKey.fromStringECDSA(cleanKey);
const client = Client.forTestnet().setOperator(operatorId, operatorKey);

async function main() {
    const tokenId = TokenId.fromString("0.0.8726991");
    // We want 10,000,000 additional tokens. With 8 decimals, that's 10M * 10^8
    const amount = 10000000n * 100000000n; // 10,000,000 * 10^8
    
    console.log(`🚀 Minting ${amount} units for ${tokenId}...`);

    try {
        const transaction = await new TokenMintTransaction()
            .setTokenId(tokenId)
            .setAmount(amount)
            .execute(client);

        const receipt = await transaction.getReceipt(client);
        console.log(`✅ Success! New total supply: ${receipt.totalSupply.toString()}`);
    } catch (e) {
        console.error("❌ Mint failed:", e);
    }
    process.exit();
}

main();
