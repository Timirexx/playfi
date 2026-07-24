/**
 * Regression suite for PlayFiTreasury.sol — the shared, game-logic-free treasury.
 *
 * Standalone: compiles with solc and runs against an in-memory ganache EVM.
 * A tiny MockGame contract stands in for an authorized game contract so the
 * onlyGame paths (receiveBet / payout) can be exercised from a contract caller.
 *
 * Run with: npm run test:treasury
 */
const solc = require("solc");
const ganache = require("ganache");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const TREASURY_DIR = path.join(REPO_ROOT, "contracts", "treasury");

function findImport(importPath) {
  if (importPath.startsWith("@openzeppelin/")) {
    const p = path.join(REPO_ROOT, "node_modules", importPath);
    if (fs.existsSync(p)) return { contents: fs.readFileSync(p, "utf8") };
  }
  return { error: "File not found: " + importPath };
}

// A minimal authorized-game stand-in: forwards bets and relays payout calls.
const MOCK_GAME = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface ITreasuryLike {
    function receiveBet(address player) external payable;
    function payout(address winner, uint256 amount) external;
}
contract MockGame {
    ITreasuryLike public treasury;
    constructor(address t) { treasury = ITreasuryLike(t); }
    function bet(address player) external payable { treasury.receiveBet{value: msg.value}(player); }
    function win(address winner, uint256 amount) external { treasury.payout(winner, amount); }
}`;

function compile() {
  const sources = {
    "PlayFiTreasury.sol": { content: fs.readFileSync(path.join(TREASURY_DIR, "PlayFiTreasury.sol"), "utf8") },
    "MockGame.sol": { content: MOCK_GAME },
  };
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
    if (tx && typeof tx.wait === "function") await tx.wait();
    bad(desc, "expected revert but succeeded");
  } catch { ok(desc); }
}
async function rawBalance(provider, addr) {
  const hex = await provider.request({ method: "eth_getBalance", params: [addr, "latest"] });
  return BigInt(hex);
}
// ganache's eth_accounts returns lowercase; ethers returns checksummed. Compare case-insensitively.
const sameAddr = (a, b) => a.toLowerCase() === b.toLowerCase();

async function main() {
  const output = compile();
  const provider = ganache.provider({ wallet: { totalAccounts: 5 }, logging: { quiet: true } });
  const ep = new ethers.BrowserProvider(provider);
  const [ownerAddr, feeRecipientAddr, playerAddr, winnerAddr, strangerAddr] =
    await provider.request({ method: "eth_accounts", params: [] });
  const owner = await ep.getSigner(ownerAddr);
  const stranger = await ep.getSigner(strangerAddr);

  const tData = output.contracts["PlayFiTreasury.sol"]["PlayFiTreasury"];
  const gData = output.contracts["MockGame.sol"]["MockGame"];

  const tFactory = new ethers.ContractFactory(tData.abi, tData.evm.bytecode.object, owner);
  const t0 = await tFactory.deploy(ownerAddr, feeRecipientAddr);
  await t0.waitForDeployment();
  const treasuryAddr = await t0.getAddress();
  const treasury = new ethers.Contract(treasuryAddr, tData.abi, ep);

  const gFactory = new ethers.ContractFactory(gData.abi, gData.evm.bytecode.object, owner);
  const g0 = await gFactory.deploy(treasuryAddr);
  await g0.waitForDeployment();
  const game = new ethers.Contract(await g0.getAddress(), gData.abi, ep);
  const gameAddr = await game.getAddress();

  console.log("\n=== PlayFiTreasury.sol ===");

  // fee recipient set at construction
  if (sameAddr(await treasury.feeRecipient(), feeRecipientAddr)) ok("fee recipient set at construction");
  else bad("fee recipient set at construction", await treasury.feeRecipient());

  // access control on admin
  await expectRevert(treasury.connect(stranger).setGameAuthorization(gameAddr, true), "non-owner cannot authorize a game");
  await (await treasury.connect(owner).setGameAuthorization(gameAddr, true)).wait();
  ok("owner can authorize a game");

  // unauthorized game cannot route bets
  const badGame = await (await new ethers.ContractFactory(gData.abi, gData.evm.bytecode.object, owner).deploy(treasuryAddr)).waitForDeployment();
  await expectRevert(badGame.connect(owner).bet(playerAddr, { value: ethers.parseEther("1") }), "unauthorized game cannot receiveBet");

  // receiveBet: 5% fee split
  const bet = ethers.parseEther("100");
  await (await game.connect(owner).bet(playerAddr, { value: bet })).wait();
  const expectedFee = bet * 5n / 100n;
  const expectedPool = bet - expectedFee;
  const fees = await treasury.platformFees();
  const pool = await treasury.payoutPool();
  if (fees === expectedFee) ok(`takes exactly 5% fee (${ethers.formatEther(fees)} of ${ethers.formatEther(bet)})`);
  else bad("takes exactly 5% fee", `${fees} != ${expectedFee}`);
  if (pool === expectedPool) ok("credits 95% to the payout pool");
  else bad("credits 95% to the payout pool", `${pool} != ${expectedPool}`);

  // zero-value bet rejected
  await expectRevert(game.connect(owner).bet(playerAddr, { value: 0 }), "rejects zero-value bet");

  // payout: only authorized game
  await expectRevert(treasury.connect(stranger).payout(winnerAddr, 1n), "stranger cannot call payout directly");
  await expectRevert(treasury.connect(owner).payout(winnerAddr, 1n), "even owner cannot call payout (games only)");

  // payout pays winner and reduces pool
  const winAmt = ethers.parseEther("10");
  const wBefore = await rawBalance(provider, winnerAddr);
  await (await game.connect(owner).win(winnerAddr, winAmt)).wait();
  const wAfter = await rawBalance(provider, winnerAddr);
  if (wAfter - wBefore === winAmt) ok("authorized game payout pays the winner exactly");
  else bad("authorized game payout pays the winner exactly", `${wAfter - wBefore} != ${winAmt}`);
  if ((await treasury.payoutPool()) === expectedPool - winAmt) ok("payout reduces the pool");
  else bad("payout reduces the pool", (await treasury.payoutPool()).toString());

  // payout cannot exceed pool
  await expectRevert(game.connect(owner).win(winnerAddr, ethers.parseEther("1000000")), "payout cannot exceed the pool");

  // withdrawFees goes to fee recipient
  await expectRevert(treasury.connect(stranger).withdrawFees(1n), "non-owner cannot withdraw fees");
  const frBefore = await rawBalance(provider, feeRecipientAddr);
  await (await treasury.connect(owner).withdrawFees(expectedFee)).wait();
  const frAfter = await rawBalance(provider, feeRecipientAddr);
  if (frAfter - frBefore === expectedFee) ok("withdrawFees pays the fee recipient exactly");
  else bad("withdrawFees pays the fee recipient exactly", `${frAfter - frBefore} != ${expectedFee}`);
  if ((await treasury.platformFees()) === 0n) ok("accrued fees reset after withdrawal");
  else bad("accrued fees reset after withdrawal", (await treasury.platformFees()).toString());

  // cannot withdraw more fees than accrued
  await expectRevert(treasury.connect(owner).withdrawFees(1n), "cannot withdraw more fees than accrued");

  // fee recipient update
  await expectRevert(treasury.connect(stranger).setFeeRecipient(strangerAddr), "non-owner cannot change fee recipient");
  await (await treasury.connect(owner).setFeeRecipient(ownerAddr)).wait();
  if (sameAddr(await treasury.feeRecipient(), ownerAddr)) ok("owner can update fee recipient");
  else bad("owner can update fee recipient", await treasury.feeRecipient());

  // pause blocks bets + payouts; enables emergency withdraw
  await expectRevert(treasury.connect(stranger).pause(), "non-owner cannot pause");
  await (await treasury.connect(owner).pause()).wait();
  await expectRevert(game.connect(owner).bet(playerAddr, { value: bet }), "paused treasury rejects receiveBet");
  await expectRevert(game.connect(owner).win(winnerAddr, 1n), "paused treasury rejects payout");

  const balBefore = await rawBalance(provider, treasuryAddr);
  if (balBefore > 0n) {
    const oBefore = await rawBalance(provider, ownerAddr);
    await (await treasury.connect(owner).emergencyWithdraw()).wait();
    const oAfter = await rawBalance(provider, ownerAddr);
    if (oAfter > oBefore) ok("owner can emergencyWithdraw while paused");
    else bad("owner can emergencyWithdraw while paused", `${oAfter - oBefore}`);
    if ((await rawBalance(provider, treasuryAddr)) === 0n) ok("emergencyWithdraw drains the treasury");
    else bad("emergencyWithdraw drains the treasury", (await rawBalance(provider, treasuryAddr)).toString());
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => { console.error("FATAL:", e); process.exitCode = 1; });
