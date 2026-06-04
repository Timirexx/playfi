import fs from 'fs';
import path from 'path';
import solc from 'solc';

const contractPath = path.resolve('contracts', 'PlayFiVault.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'PlayFiVault.sol': {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode']
            }
        },
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};

console.log('Compiling PlayFiVault...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach(err => {
        console.error(err.formattedMessage);
    });
    if (output.errors.some(err => err.severity === 'error')) {
        process.exit(1);
    }
}

const contract = output.contracts['PlayFiVault.sol']['PlayFiVault'];
const artifactsDir = path.resolve('artifacts');

if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir);
}

fs.writeFileSync(
    path.join(artifactsDir, 'PlayFiVault.json'),
    JSON.stringify(contract, null, 2)
);

console.log('Compilation successful. Artifact saved to artifacts/PlayFiVault.json');
