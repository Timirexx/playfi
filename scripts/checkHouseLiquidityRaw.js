import { ethers } from "ethers";

async function main() {
    const rpcUrl = "https://testnet.hashio.io/api";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const vaultAddress = "0x434BcA79801eB0d0E1838d63B8Bc1FCb09040d28";
    
    const vaultAbi = [
        "function houseLiquidity() public view returns (uint256)",
        "function getVaultBalance() public view returns (uint256)"
    ];

    const vaultContract = new ethers.Contract(vaultAddress, vaultAbi, provider);

    const liquidity = await vaultContract.houseLiquidity();
    const balance = await vaultContract.getVaultBalance();

    console.log(`🏦 Raw House Liquidity (wei/tinybars): ${liquidity.toString()}`);
    console.log(`💰 Raw Total Vault Balance: ${balance.toString()}`);
    
    // In Hedera, 1 HBAR = 10^8 tinybars
    const hbarLiquidity = Number(liquidity) / 100000000;
    const hbarBalance = Number(balance) / 100000000;
    
    console.log(`🏦 Corrected House Liquidity: ${hbarLiquidity} HBAR`);
    console.log(`💰 Corrected Total Vault Balance: ${hbarBalance} HBAR`);
}

main().catch(console.error);
