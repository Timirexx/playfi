const { ethers } = require("hardhat");

async function main() {
    const vaultAddress = "0xE0f1A9c2BdF92be3E318783a9732512fa13069Bc";
    console.log("Deploying PlayFiGames with Vault:", vaultAddress);

    const Games = await ethers.getContractFactory("PlayFiGames");
    const games = await Games.deploy(vaultAddress);
    await games.waitForDeployment();

    const gamesAddress = await games.getAddress();
    console.log("PlayFiGames deployed to:", gamesAddress);

    // Now authorize the games contract in the vault
    console.log("Authorizing Games in Vault...");
    const Vault = await ethers.getContractFactory("PlayFiVault");
    const vault = Vault.attach(vaultAddress);
    
    const tx = await vault.setGameAuthorization(gamesAddress, true);
    await tx.wait();
    console.log("Authorization successful!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
