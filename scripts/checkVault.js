const { ethers } = require("hardhat");

async function main() {
    const vaultAddress = "0xE0f1A9c2BdF92be3E318783a9732512fa13069Bc";
    const [deployer] = await ethers.getSigners();
    
    console.log("Checking Vault at:", vaultAddress);
    const balance = await ethers.provider.getBalance(vaultAddress);
    console.log("Native HBAR Balance:", ethers.formatEther(balance));

    const Vault = await ethers.getContractFactory("PlayFiVault");
    const vault = Vault.attach(vaultAddress);
    
    try {
        const owner = await vault.owner();
        console.log("Vault Owner:", owner);
    } catch (e) {
        console.log("Could not fetch owner - address might not be a contract or wrong ABI.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
