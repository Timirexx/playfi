const hre = require("hardhat");

async function main() {
  console.log("Deploying PlayFiLeaderboard...");

  const Leaderboard = await hre.ethers.getContractFactory("PlayFiLeaderboard");
  const leaderboard = await Leaderboard.deploy();

  await leaderboard.waitForDeployment();

  const address = await leaderboard.getAddress();
  console.log("✅ PlayFiLeaderboard deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
