import { ethers } from "ethers";

export let provider = null;
export let signer = null;

export const connectWallet = async () => {
    console.log("[EVM] Triggering MetaMask connection...");
    
    if (typeof window.ethereum === 'undefined') {
        alert("MetaMask (or a Web3 wallet) is not installed! Please install it to connect.");
        return null;
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Ensure we are on Hedera Testnet (Chain ID 296 / 0x128)
        await switchToHederaTestnet();

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        
        const address = accounts[0];
        console.log("[EVM] Connected to:", address);
        
        // Dispatch custom global event so app.js can catch it synchronously
        window.dispatchEvent(new CustomEvent('evm_wallet_connected', { detail: { address } }));
        return address;
    } catch (error) {
        console.error("[EVM] Connection Failed:", error);
        return null;
    }
};

const switchToHederaTestnet = async () => {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x128' }], // 296 in hex
        });
    } catch (error) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (error.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: '0x128', // 296
                            chainName: 'Hedera Testnet',
                            nativeCurrency: {
                                name: 'HBAR',
                                symbol: 'HBAR', // 2-6 characters long
                                decimals: 18
                            },
                            rpcUrls: ['https://testnet.hashio.io/api'],
                            blockExplorerUrls: ['https://hashscan.io/testnet/']
                        },
                    ],
                });
            } catch (addError) {
                console.error("[EVM] Failed to add Hedera Network", addError);
            }
        }
    }
};

export const initWallet = async () => {
    console.log("[EVM] Initializing Wallet Listener...");
    
    const connectBtns = document.querySelectorAll('#connect-btn, .lock-overlay .btn');
    
    if (typeof window.ethereum !== 'undefined') {
        // Restore button state
        connectBtns.forEach(btn => {
            btn.disabled = false;
            btn.innerText = "Connect Wallet";
        });

        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                window.dispatchEvent(new CustomEvent('evm_wallet_connected', { detail: { address: accounts[0] } }));
            } else {
                window.dispatchEvent(new CustomEvent('evm_wallet_disconnected'));
            }
        });

        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
        
        // Auto-connect if already authorized
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                window.dispatchEvent(new CustomEvent('evm_wallet_connected', { detail: { address: accounts[0] } }));
            }
        } catch(e) {
            console.error(e);
        }

        return true;
    } else {
        console.warn("[EVM] No Web3 provider detected.");
        connectBtns.forEach(btn => {
            btn.innerText = "Get MetaMask";
            btn.onclick = () => window.open('https://metamask.io/download/', '_blank');
        });
        return false;
    }
};
