import { ethers } from "ethers";

async function main() {
    const vaultAddress = "0xE0f1A9c2BdF92be3E318783a9732512fa13069Bc";
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    
    console.log("Checking Vault at:", vaultAddress);
    const balance = await provider.getBalance(vaultAddress);
    console.log("Native HBAR Balance:", ethers.formatEther(balance));

    const abi = [
        "function owner() public view returns (address)",
        "function userBalances(address) public view returns (uint256)"
    ];
    const vault = new ethers.Contract(vaultAddress, abi, provider);
    
    try {
        const owner = await vault.owner();
        console.log("Vault Owner:", owner);
        
        // Check a known user address if provided, or just check the contract's overall state
        const testUser = "0xc517DAe8a3b8FF9f5AD85ab4662b1bAebcC5F3Dd";
        const userBalance = await vault.userBalances(testUser);
        console.log(`User ${testUser} Balance:`, ethers.formatEther(userBalance), "HBAR");
    } catch (e) {
        console.log("Error checking contract state:", e.message);
    }
}

main();
