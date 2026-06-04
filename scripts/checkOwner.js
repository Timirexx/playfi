import { ethers } from "ethers";

async function main() {
    const vaultAddress = "0xE0f1A9c2BdF92be3E318783a9732512fa13069Bc";
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const vault = new ethers.Contract(vaultAddress, ["function owner() view returns (address)"], provider);
    
    console.log("Vault Owner:", await vault.owner());
}

main();
