import fs from "fs";
import path from "path";
import solc from "solc";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractPath = path.resolve(__dirname, "../contracts/PlayFiLeaderboard.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "PlayFiLeaderboard.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
  },
};

console.log("Compiling...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  output.errors.forEach((err) => {
    console.error(err.formattedMessage);
  });
  if (output.errors.some(e => e.severity === 'error')) process.exit(1);
}

const contract = output.contracts["PlayFiLeaderboard.sol"]["PlayFiLeaderboard"];

const outPath = path.resolve(__dirname, "../src/contracts/PlayFiLeaderboard.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(contract, null, 2));

console.log("✅ Compiled and saved to src/contracts/PlayFiLeaderboard.json");
