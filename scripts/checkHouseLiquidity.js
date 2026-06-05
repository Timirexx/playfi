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

    console.log(`🏦 House Liquidity: ${ethers.formatEther(liquidity)} HBAR`);
    console.log(`💰 Total Vault Balance: ${ethers.formatEther(balance)} HBAR`);
}

main().catch(console.error);
