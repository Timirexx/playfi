import { ethers } from "ethers";

async function main() {
    const vaultAddress = "0xE0f1A9c2BdF92be3E318783a9732512fa13069Bc";
    const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
    const contract = new ethers.Contract(vaultAddress, [
        "event Deposited(address indexed user, uint256 amount)"
    ], provider);
    
    console.log("Fetching recent Deposited events...");
    const filter = contract.filters.Deposited();
    const events = await contract.queryFilter(filter, -1000); // last 1000 blocks
    
    events.forEach(e => {
        console.log(`User: ${e.args.user} | Amount: ${ethers.formatEther(e.args.amount)} HBAR`);
    });
}

main();
