const hre = require("hardhat");

async function main() {
  console.log("Deploying PlayFiVault...");

  const PlayFiVault = await hre.ethers.getContractFactory("PlayFiVault");
  const vault = await PlayFiVault.deploy();

  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("PlayFiVault deployed to:", address);
  
  // Fund the house with initial liquidity (0.1 HBAR for testing)
  console.log("Funding house liquidity...");
  const fundTx = await vault.fundHouse({ value: hre.ethers.parseEther("0.1") });
  await fundTx.wait();
  console.log("House funded successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
