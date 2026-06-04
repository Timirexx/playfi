import { ethers } from "ethers";

async function main() {
    const vaultAddress = "0xE0f1A9c2BdF92be3E318783a9732512fa13069Bc";
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const abi = ["function userBalances(address) public view returns (uint256)"];
    const vault = new ethers.Contract(vaultAddress, abi, provider);
    
    const evmAddr = "0xc517DAe8a3b8FF9f5AD85ab4662b1bAebcC5F3Dd";
    const nativeAlias = "0x000000000000000000000000000000000084d561"; // 0.0.8705377
    
    console.log(`Checking balance for EVM: ${evmAddr}`);
    const b1 = await vault.userBalances(evmAddr);
    console.log(`Balance: ${ethers.formatEther(b1)} HBAR`);
    
    console.log(`Checking balance for Alias: ${nativeAlias}`);
    const b2 = await vault.userBalances(nativeAlias);
    console.log(`Balance: ${ethers.formatEther(b2)} HBAR`);
}

main();
