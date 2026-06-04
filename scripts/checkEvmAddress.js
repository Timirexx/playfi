import { AccountId, Client, AccountInfoQuery, PrivateKey } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const accountId = AccountId.fromString(process.env.TREASURY_ACCOUNT_ID);
    const privateKey = PrivateKey.fromStringDer(process.env.TREASURY_PRIVATE_KEY.startsWith("0x")
        ? process.env.TREASURY_PRIVATE_KEY.slice(2)  // remove 0x for DER if needed
        : process.env.TREASURY_PRIVATE_KEY);

    const client = Client.forTestnet().setOperator(accountId, privateKey);

    console.log("🔍 Querying account info for:", accountId.toString());
    
    const info = await new AccountInfoQuery()
        .setAccountId(accountId)
        .execute(client);

    console.log("\n✅ Account Info:");
    console.log("  Account ID:", info.accountId.toString());
    console.log("  EVM Address:", info.contractAccountId || info.evmAddress || "(not set)");
    console.log("  Balance:", info.balance.toString());
    
    // Canonical Hedera EVM address for account 0.0.X is:
    const numericId = accountId.num;
    const canonicalEvm = "0x" + numericId.toString(16).padStart(40, '0');
    console.log("\n📋 Canonical Hedera EVM Address (0.0." + numericId + "):", canonicalEvm);
    
    client.close();
}

main().catch(console.error);
