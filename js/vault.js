import { ethers } from 'ethers';

const VAULT_ADDRESS = "0x1bBAd087c98185cF88Aa6d4C0018863b444caFE7";
const VAULT_ABI = [
    "function deposit() public payable",
    "function withdraw(uint256 amount) public",
    "function userBalances(address) public view returns (uint256)",
    "function getVaultBalance() public view returns (uint256)",
    "event Deposit(address indexed user, uint256 amount)",
    "event Withdrawal(address indexed user, uint256 amount)"
];

const vaultManager = {
    state: {
        vaultBalance: "0.00"
    },

    async init() {
        console.log("[VAULT] Manager Initialized");
        this.updateUI();
        
        window.addEventListener('walletConnected', () => {
            this.refreshBalance();
        });
    },

    async refreshBalance() {
        if (!window.app || !window.app.state.isConnected) return;
        
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
            const balance = await contract.userBalances(window.app.state.walletAddress);
            this.state.vaultBalance = ethers.formatEther(balance);
            this.updateUI();
        } catch (err) {
            console.error("[VAULT] Balance Refresh Error:", err);
        }
    },

    updateUI() {
        const display = document.getElementById('vault-balance-display');
        if (display) {
            display.innerText = `${parseFloat(this.state.vaultBalance).toFixed(2)} HBAR`;
        }
    },

    async deposit() {
        if (!window.app || !window.app.state.isConnected) {
            return window.app.showToast("Connect wallet first", "error");
        }
        
        const amount = document.getElementById('vault-amount').value;
        if (!amount || amount <= 0) return window.app.showToast("Invalid amount", "error");

        window.app.showTxOverlay('Vault Deposit', 'Confirm the deposit in your wallet...');
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

            const tx = await contract.deposit({ value: ethers.parseEther(amount) });
            await tx.wait();
            
            window.app.showToast("Deposit successful!", "success");
            await this.refreshBalance();
            await window.app.refreshBalance();
        } catch (err) {
            console.error("[VAULT] Deposit Error:", err);
            window.app.showToast(err.reason || err.message || "Deposit failed", "error");
        } finally {
            window.app.hideTxOverlay();
        }
    },

    async withdraw() {
        if (!window.app || !window.app.state.isConnected) {
            return window.app.showToast("Connect wallet first", "error");
        }
        
        const amount = document.getElementById('vault-amount').value;
        if (!amount || amount <= 0) return window.app.showToast("Invalid amount", "error");

        window.app.showTxOverlay('Vault Withdrawal', 'Confirm the withdrawal in your wallet...');
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

            const tx = await contract.withdraw(ethers.parseEther(amount));
            await tx.wait();
            
            window.app.showToast("Withdrawal successful!", "success");
            await this.refreshBalance();
            await window.app.refreshBalance();
        } catch (err) {
            console.error("[VAULT] Withdrawal Error:", err);
            window.app.showToast(err.reason || err.message || "Withdrawal failed", "error");
        } finally {
            window.app.hideTxOverlay();
        }
    }
};

window.vaultManager = vaultManager;
document.addEventListener('DOMContentLoaded', () => vaultManager.init());
