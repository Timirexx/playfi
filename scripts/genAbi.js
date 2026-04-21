import fs from "fs";
const tokenAbi = JSON.parse(fs.readFileSync('artifacts/contracts/PlayToken.sol/PlayToken.json')).abi;
const vaultAbi = JSON.parse(fs.readFileSync('artifacts/contracts/PlayFiVault.sol/PlayFiVault.json')).abi;
const content = `export const PLAY_TOKEN_ADDRESS = '0x70fe2c6fbDd720eE2dfc94112A5Ce2F4F127F7ed';\nexport const PLAYFI_VAULT_ADDRESS = '0xb6Bc8Ff4c54a84B0f14293609E86f13d94B6FC80';\n\nexport const PLAY_TOKEN_ABI = ${JSON.stringify(tokenAbi, null, 2)};\n\nexport const PLAYFI_VAULT_ABI = ${JSON.stringify(vaultAbi, null, 2)};\n`;
fs.writeFileSync('src/contracts/PlayFiVault.js', content);
