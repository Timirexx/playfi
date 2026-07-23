/**
 * Regression suite for the independent per-game treasury contracts
 * (Mines.sol, SpinToWin.sol, TwoDoors.sol, and their shared GameBase.sol).
 *
 * Standalone: compiles the contracts with solc and runs them against an
 * in-memory ganache EVM, rather than depending on Hardhat (whose config in
 * this repo predates Hardhat 3 and isn't wired up for its plugin system).
 *
 * Run with: npm run test:games
 */
const solc = require("solc");
const ganache = require("ganache");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const GAMES_DIR = path.join(REPO_ROOT, "contracts", "games");

function findImport(importPath) {
  const candidates = [];
  if (importPath.startsWith("@openzeppelin/")) {
    candidates.push(path.join(REPO_ROOT, "node_modules", importPath));
  } else {
    candidates.push(path.join(GAMES_DIR, importPath));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return { contents: fs.readFileSync(c, "utf8") };
  }
  return { error: "File not found: " + importPath };
}

// TwoDoors resolves via Hedera's PRNG system contract (0x169), which only
// exists on the Hedera network — not on the local ganache EVM. This harness
// subclasses the real contract and overrides only the randomness source with a
// settable value, so every other line of TwoDoors is exercised as-deployed.
const TWO_DOORS_HARNESS = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {TwoDoors} from "./TwoDoors.sol";
contract TwoDoorsHarness is TwoDoors {
    uint8 private _forcedDoor = 1;
    constructor(address o, address b) TwoDoors(o, b) {}
    function setForcedDoor(uint8 d) external { _forcedDoor = d; }
    function _treasureDoor() internal view override returns (uint8) { return _forcedDoor; }
}
`;

function compile() {
  const targets = ["GameBase.sol", "Mines.sol", "SpinToWin.sol", "TwoDoors.sol"];
  const sources = {};
  for (const t of targets) {
    sources[t] = { content: fs.readFileSync(path.join(GAMES_DIR, t), "utf8") };
  }
  sources["TwoDoorsHarness.sol"] = { content: TWO_DOORS_HARNESS };

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

  let hasError = false;
  if (output.errors) {
    for (const e of output.errors) {
      console.log(`[${e.severity}] ${e.formattedMessage}`);
      if (e.severity === "error") hasError = true;
    }
  }
  if (hasError) throw new Error("Compilation failed");
  return output;
}

let pass = 0, fail = 0;
function ok(desc) { pass++; console.log(`  ✓ ${desc}`); }
function bad(desc, err) { fail++; console.log(`  ✗ ${desc} -- ${err}`); }
async function expectRevert(promise, desc) {
  try {
    const tx = await promise;
    // A tx may pass gas estimation yet revert when mined; await the receipt so
    // that case is still caught as a (correct) revert rather than a false pass.
    if (tx && typeof tx.wait === "function") await tx.wait();
    bad(desc, "expected revert but succeeded");
  } catch (e) {
    ok(desc);
  }
}

async function rawBalance(provider, addr) {
  // ethers.BrowserProvider's getBalance() cache goes stale after several
  // contract deployments against a raw EIP-1193 provider like ganache's
  // (it doesn't emit the block-change signals BrowserProvider expects).
  // Query eth_getBalance directly to get ground truth.
  const hex = await provider.request({ method: "eth_getBalance", params: [addr, "latest"] });
  return BigInt(hex);
}

// Each game is an independent contract, so we test each on its own fresh chain.
// This also sidesteps an ethers BrowserProvider quirk where its internal caches
// go stale after many deployments/txs against a raw EIP-1193 provider (the same
// reason rawBalance() reads via the underlying provider directly).
async function setupEnv(output) {
  const provider = ganache.provider({ wallet: { totalAccounts: 5 }, logging: { quiet: true } });
  const ethersProvider = new ethers.BrowserProvider(provider);

  const accounts = await provider.request({ method: "eth_accounts", params: [] });
  const [ownerAddr, backendAddr, playerAddr, player2Addr, strangerAddr] = accounts;

  const ownerSigner = await ethersProvider.getSigner(ownerAddr);
  const backendSigner = await ethersProvider.getSigner(backendAddr);
  const playerSigner = await ethersProvider.getSigner(playerAddr);
  const player2Signer = await ethersProvider.getSigner(player2Addr);
  const strangerSigner = await ethersProvider.getSigner(strangerAddr);

  async function deploy(contractName, fileName = `${contractName}.sol`) {
    const data = output.contracts[fileName][contractName];
    const factory = new ethers.ContractFactory(data.abi, data.evm.bytecode.object, ownerSigner);
    const contract = await factory.deploy(ownerAddr, backendAddr);
    await contract.waitForDeployment();
    return new ethers.Contract(await contract.getAddress(), data.abi, ethersProvider);
  }

  return {
    provider, ethersProvider, deploy,
    ownerAddr, backendAddr, playerAddr, player2Addr, strangerAddr,
    ownerSigner, backendSigner, playerSigner, player2Signer, strangerSigner,
  };
}

async function main() {
  const output = compile();

  // ============ MINES ============
  console.log("\n=== Mines.sol ===");
  {
    const { provider, deploy, ownerAddr, backendAddr, playerAddr, strangerAddr,
      ownerSigner, backendSigner, playerSigner, strangerSigner } = await setupEnv(output);
    const mines = await deploy("Mines");
    const asPlayer = mines.connect(playerSigner);
    const asBackend = mines.connect(backendSigner);
    const asOwner = mines.connect(ownerSigner);
    const asStranger = mines.connect(strangerSigner);

    await (await asOwner.fundHouse({ value: ethers.parseEther("100") })).wait();
    ok("owner can fundHouse");

    await expectRevert(asStranger.fundHouse({ value: 1n }), "non-owner cannot fundHouse");

    const betAmount = ethers.parseEther("1");
    await (await asPlayer.startGame(3, { value: betAmount })).wait();
    ok("player can startGame with a valid mines count");

    const round = await mines.getRound(playerAddr);
    if (round.active && round.betAmount === betAmount && round.minesCount === 3n) {
      ok("round state recorded correctly");
    } else {
      bad("round state recorded correctly", JSON.stringify(round));
    }

    await expectRevert(asPlayer.startGame(3, { value: betAmount }), "cannot start a second round while one is active");
    await expectRevert(asPlayer.startGame(0, { value: betAmount }), "rejects minesCount below MIN_MINES");
    await expectRevert(asPlayer.startGame(30, { value: betAmount }), "rejects minesCount above MAX_MINES");
    await expectRevert(asPlayer.startGame(3, { value: 0 }), "rejects zero-value bet");

    await expectRevert(asStranger.resolveRound(playerAddr, 2, ethers.parseEther("2")), "stranger cannot resolveRound");

    const balBefore = await rawBalance(provider, playerAddr);
    const winAmount = ethers.parseEther("2");
    await (await asBackend.resolveRound(playerAddr, 2, winAmount)).wait();
    const balAfter = await rawBalance(provider, playerAddr);
    if (balAfter - balBefore === winAmount) {
      ok("backend resolveRound pays out exact winAmount");
    } else {
      bad("backend resolveRound pays out exact winAmount", `${balAfter - balBefore} != ${winAmount}`);
    }

    const roundAfter = await mines.getRound(playerAddr);
    if (!roundAfter.active) ok("round marked inactive after resolve"); else bad("round marked inactive after resolve", "still active");

    await expectRevert(asBackend.resolveRound(playerAddr, 1, 1n), "cannot resolve an already-resolved round");

    const contractBal = await rawBalance(provider, await mines.getAddress());
    await (await asPlayer.startGame(1, { value: ethers.parseEther("0.01") })).wait();
    await expectRevert(
      asBackend.resolveRound(playerAddr, 1, contractBal + ethers.parseEther("1000")),
      "cannot pay out more than contract balance"
    );
    await (await asBackend.resolveRound(playerAddr, 1, 0n)).wait();

    await (await asOwner.pause()).wait();
    await expectRevert(asPlayer.startGame(2, { value: betAmount }), "paused contract rejects startGame");
    await (await asOwner.emergencyWithdraw()).wait();
    ok("owner can emergencyWithdraw while paused");
    const finalBal = await rawBalance(provider, await mines.getAddress());
    if (finalBal === 0n) ok("emergencyWithdraw drains full balance"); else bad("emergencyWithdraw drains full balance", finalBal.toString());
    await (await asOwner.unpause()).wait();

    await expectRevert(asBackend.setBackendSigner(strangerAddr), "backend signer cannot rotate itself");
    await (await asOwner.setBackendSigner(strangerAddr)).wait();
    ok("owner can rotate backend signer");
    await expectRevert(asBackend.resolveRound(playerAddr, 0, 0n), "old backend signer loses access after rotation");
  }

  // ============ SPIN TO WIN ============
  console.log("\n=== SpinToWin.sol ===");
  {
    const { provider, deploy, playerAddr,
      ownerSigner, backendSigner, playerSigner } = await setupEnv(output);
    const spin = await deploy("SpinToWin");
    const asPlayer = spin.connect(playerSigner);
    const asBackend = spin.connect(backendSigner);
    const asOwner = spin.connect(ownerSigner);

    await (await asOwner.fundHouse({ value: ethers.parseEther("100") })).wait();

    await expectRevert(asPlayer.placeBet(3, { value: ethers.parseEther("1") }), "rejects invalid multiplier (3 is not a valid slice)");

    const bet = ethers.parseEther("1");
    await (await asPlayer.placeBet(5, { value: bet })).wait();
    ok("accepts valid multiplier bet");

    await expectRevert(asPlayer.placeBet(2, { value: bet }), "cannot place a second bet while one is pending");

    const balBefore = await rawBalance(provider, playerAddr);
    const payout = bet * 5n;
    await (await asBackend.resolveSpin(playerAddr, 5, payout)).wait();
    const balAfter = await rawBalance(provider, playerAddr);
    if (balAfter - balBefore === payout) ok("winning resolveSpin pays exact multiplier payout");
    else bad("winning resolveSpin pays exact multiplier payout", `${balAfter - balBefore} != ${payout}`);

    await (await asPlayer.placeBet(10, { value: bet })).wait();
    const balBeforeLoss = await rawBalance(provider, playerAddr);
    await (await asBackend.resolveSpin(playerAddr, 2, 0n)).wait();
    const balAfterLoss = await rawBalance(provider, playerAddr);
    if (balAfterLoss === balBeforeLoss) ok("losing resolveSpin transfers nothing to player");
    else bad("losing resolveSpin transfers nothing to player", "balance changed unexpectedly");

    const stats = await spin.getStats(playerAddr);
    if (stats.betsPlaced === 2n && stats.totalWagered === bet * 2n && stats.totalWon === payout) {
      ok("player stats accumulate correctly across rounds");
    } else {
      bad("player stats accumulate correctly across rounds", JSON.stringify(stats));
    }
  }

  // ============ TWO DOORS (on-chain PRNG + keeper reveal) ============
  // Deployed via the harness so the Hedera-PRNG treasure door can be forced
  // deterministically; every other code path is the real TwoDoors contract.
  console.log("\n=== TwoDoors.sol ===");
  {
    const { provider, deploy, playerAddr, player2Addr,
      ownerSigner, backendSigner, playerSigner, player2Signer } = await setupEnv(output);
    const doors = await deploy("TwoDoorsHarness", "TwoDoorsHarness.sol");
    const asPlayer = doors.connect(playerSigner);
    const asPlayer2 = doors.connect(player2Signer);
    const asBackend = doors.connect(backendSigner);
    const asOwner = doors.connect(ownerSigner);

    await (await asOwner.fundHouse({ value: ethers.parseEther("100") })).wait();

    const bet = ethers.parseEther("1");

    // --- Winning path: choose door 1, force treasure door 1 ---
    await expectRevert(asPlayer.placeBet({ value: 0 }), "rejects zero-value stake");
    await (await asPlayer.placeBet({ value: bet })).wait();
    ok("player can stake to start a game");

    let g = await doors.getGame(playerAddr);
    if (g.status === 1n && g.betAmount === bet) ok("game state = Staked after placeBet");
    else bad("game state = Staked after placeBet", JSON.stringify(g));

    await expectRevert(asPlayer.placeBet({ value: bet }), "cannot stake a second game while one is in progress");
    await expectRevert(asPlayer.chooseDoor(3), "rejects door outside {1,2}");
    await expectRevert(asBackend.resolveGame(playerAddr), "cannot resolve before a door is chosen");

    await (await asPlayer.chooseDoor(1)).wait();
    ok("player can choose a door");
    g = await doors.getGame(playerAddr);
    if (g.status === 2n && g.chosenDoor === 1n) ok("game state = DoorChosen after chooseDoor");
    else bad("game state = DoorChosen after chooseDoor", JSON.stringify(g));

    await expectRevert(asPlayer.resolveGame(playerAddr), "player cannot resolve their own game");

    await (await asOwner.setForcedDoor(1)).wait(); // treasure behind door 1 => player wins
    const balBefore = await rawBalance(provider, playerAddr);
    await (await asBackend.resolveGame(playerAddr)).wait();
    const balAfter = await rawBalance(provider, playerAddr);
    const payout = bet * 2n;
    if (balAfter - balBefore === payout) ok("winning resolve pays exact 2x from treasury");
    else bad("winning resolve pays exact 2x from treasury", `${balAfter - balBefore} != ${payout}`);

    g = await doors.getGame(playerAddr);
    if (g.status === 3n && g.won === true && g.treasureDoor === 1n) ok("game marked Resolved + won");
    else bad("game marked Resolved + won", JSON.stringify(g));

    await expectRevert(asBackend.resolveGame(playerAddr), "cannot resolve an already-resolved game");

    // --- Losing path: choose door 1, force treasure door 2 ---
    await (await asPlayer2.placeBet({ value: bet })).wait();
    await (await asPlayer2.chooseDoor(1)).wait();
    await (await asOwner.setForcedDoor(2)).wait(); // treasure behind door 2 => player2 loses
    const p2Before = await rawBalance(provider, player2Addr);
    await (await asBackend.resolveGame(player2Addr)).wait();
    const p2After = await rawBalance(provider, player2Addr);
    if (p2After === p2Before) ok("losing resolve transfers nothing to player");
    else bad("losing resolve transfers nothing to player", `${p2After - p2Before}`);
    const g2 = await doors.getGame(player2Addr);
    if (g2.won === false && g2.status === 3n) ok("losing game marked Resolved + not won");
    else bad("losing game marked Resolved + not won", JSON.stringify(g2));

    // --- Stats accumulate; player can start a fresh game after resolution ---
    const s = await doors.getStats(playerAddr);
    if (s.betsPlaced === 1n && s.totalWagered === bet && s.totalWon === payout) ok("player stats accumulate correctly");
    else bad("player stats accumulate correctly", JSON.stringify(s));
    await (await asPlayer.placeBet({ value: bet })).wait();
    ok("player can start a new game after the previous one resolved");

    // --- reclaimStake timeout safety valve ---
    await expectRevert(asPlayer.reclaimStake(), "cannot reclaim before the resolve timeout");
    await provider.request({ method: "evm_increaseTime", params: [3601] });
    await provider.request({ method: "evm_mine", params: [] });
    const rBefore = await rawBalance(provider, playerAddr);
    // Pass an explicit gasLimit so ethers skips eth_estimateGas: after a manual
    // evm_increaseTime jump its estimateGas simulates against a stale timestamp
    // and spuriously reverts. The real mined tx runs against the bumped time and
    // succeeds; .wait() below still surfaces any genuine revert.
    await (await asPlayer.reclaimStake({ gasLimit: 200000 })).wait();
    const rAfter = await rawBalance(provider, playerAddr);
    if (rAfter > rBefore) ok("player can reclaim a stuck stake after timeout");
    else bad("player can reclaim a stuck stake after timeout", `${rAfter - rBefore}`);

    // --- pause blocks new stakes ---
    await (await asOwner.pause()).wait();
    await expectRevert(asPlayer.placeBet({ value: bet }), "paused contract rejects placeBet");
    await (await asOwner.unpause()).wait();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => { console.error("FATAL:", e); process.exitCode = 1; });
