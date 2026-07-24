/**
 * Integration suite for PlayFiGameHub.sol + PlayFiTreasury.sol — the single
 * game contract and single treasury working together.
 *
 * Run with: npm run test:hub
 */
const solc = require("solc");
const ganache = require("ganache");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

function findImport(importPath) {
  // solc normalizes relative imports (e.g. "../treasury/ITreasury.sol" -> "treasury/ITreasury.sol").
  const candidates = [];
  if (importPath.startsWith("@openzeppelin/")) {
    candidates.push(path.join(REPO_ROOT, "node_modules", importPath));
  } else {
    const base = importPath.replace(/^(\.\.\/)+/, "");
    candidates.push(path.join(REPO_ROOT, "contracts", base));            // e.g. treasury/ITreasury.sol
    candidates.push(path.join(REPO_ROOT, "contracts", "games", base));
    candidates.push(path.join(REPO_ROOT, "contracts", "treasury", path.basename(base)));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return { contents: fs.readFileSync(c, "utf8") };
  }
  return { error: "File not found: " + importPath };
}

function compile() {
  const sources = {
    "PlayFiTreasury.sol": { content: fs.readFileSync(path.join(REPO_ROOT, "contracts", "treasury", "PlayFiTreasury.sol"), "utf8") },
    "PlayFiGameHub.sol": { content: fs.readFileSync(path.join(REPO_ROOT, "contracts", "games", "PlayFiGameHub.sol"), "utf8") },
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

async function main() {
  const output = compile();
  const provider = ganache.provider({ wallet: { totalAccounts: 5 }, logging: { quiet: true } });
  const ep = new ethers.BrowserProvider(provider);
  const [ownerAddr, backendAddr, playerAddr, feeRecipientAddr, strangerAddr] =
    await provider.request({ method: "eth_accounts", params: [] });
  const owner = await ep.getSigner(ownerAddr);
  const backend = await ep.getSigner(backendAddr);
  const player = await ep.getSigner(playerAddr);
  const stranger = await ep.getSigner(strangerAddr);

  const tData = output.contracts["PlayFiTreasury.sol"]["PlayFiTreasury"];
  const hData = output.contracts["PlayFiGameHub.sol"]["PlayFiGameHub"];

  // Deploy treasury (owner, feeRecipient)
  const treasury = new ethers.Contract(
    await (await new ethers.ContractFactory(tData.abi, tData.evm.bytecode.object, owner).deploy(ownerAddr, feeRecipientAddr)).waitForDeployment().then(c => c.getAddress()),
    tData.abi, ep);

  // Deploy hub (owner, treasury, backendSigner)
  const hub = new ethers.Contract(
    await (await new ethers.ContractFactory(hData.abi, hData.evm.bytecode.object, owner).deploy(ownerAddr, await treasury.getAddress(), backendAddr)).waitForDeployment().then(c => c.getAddress()),
    hData.abi, ep);
  const hubAddr = await hub.getAddress();

  console.log("\n=== PlayFiGameHub + PlayFiTreasury ===");

  // Before authorization, the hub can't route bets into the treasury.
  await expectRevert(hub.connect(player).placeBet(2, { value: ethers.parseEther("1") }), "unauthorized hub cannot place a bet into the treasury");

  await (await treasury.connect(owner).setGameAuthorization(hubAddr, true)).wait();
  ok("owner authorizes the hub in the treasury");

  // Seed payout liquidity so wins can be paid.
  await (await treasury.connect(owner).fundPool({ value: ethers.parseEther("100") })).wait();

  // placeBet routes stake to treasury with 5% fee.
  const bet = ethers.parseEther("10");
  await (await hub.connect(player).placeBet(2, { value: bet })).wait(); // Two Doors
  ok("player can place a bet through the hub");

  const expectedFee = bet * 5n / 100n;
  const fees = await treasury.platformFees();
  if (fees === expectedFee) ok("treasury took the 5% platform fee from the bet");
  else bad("treasury took the 5% platform fee from the bet", `${fees} != ${expectedFee}`);

  // invalid game id + zero value rejected
  await expectRevert(hub.connect(player).placeBet(3, { value: bet }), "rejects invalid gameId");
  await expectRevert(hub.connect(player).placeBet(0, { value: 0 }), "rejects zero-value bet");

  // settleBet: only backend
  await expectRevert(hub.connect(stranger).settleBet(playerAddr, 2, ethers.parseEther("20")), "stranger cannot settle");

  // winning settle pays 2x from treasury
  const winAmount = bet * 2n;
  const balBefore = await rawBalance(provider, playerAddr);
  await (await hub.connect(backend).settleBet(playerAddr, 2, winAmount)).wait();
  const balAfter = await rawBalance(provider, playerAddr);
  if (balAfter - balBefore === winAmount) ok("winning settle pays the player 2x via the treasury");
  else bad("winning settle pays the player 2x via the treasury", `${balAfter - balBefore} != ${winAmount}`);

  // losing settle pays nothing
  await (await hub.connect(player).placeBet(1, { value: bet })).wait(); // Spin
  const bBefore = await rawBalance(provider, playerAddr);
  await (await hub.connect(backend).settleBet(playerAddr, 1, 0n)).wait();
  const bAfter = await rawBalance(provider, playerAddr);
  if (bAfter === bBefore) ok("losing settle transfers nothing to the player");
  else bad("losing settle transfers nothing to the player", `${bAfter - bBefore}`);

  // backend signer rotation
  await expectRevert(hub.connect(backend).setBackendSigner(strangerAddr), "backend cannot rotate itself");
  await (await hub.connect(owner).setBackendSigner(strangerAddr)).wait();
  await expectRevert(hub.connect(backend).settleBet(playerAddr, 1, 0n), "old backend loses settle access after rotation");
  ok("owner can rotate the backend signer");

  // pause blocks new bets
  await (await hub.connect(owner).pause()).wait();
  await expectRevert(hub.connect(player).placeBet(0, { value: bet }), "paused hub rejects new bets");
  await (await hub.connect(owner).unpause()).wait();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => { console.error("FATAL:", e); process.exitCode = 1; });
