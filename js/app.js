import { initWallet, connectWallet, modal, wagmiAdapter } from '../src/wallet.js'
import { getAccount, sendTransaction, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { parseUnits, parseEther } from 'viem'
import { ethers } from 'ethers'

// Official House Address for Hedera Testnet
const HOUSE_ADDRESS = '0x874cd1a4a234272a69b449422b668ce0c9bb2c57'

// Leaderboard Contract
const LEADERBOARD_ADDRESS = '0xfc700DDAe596a13163A3FaFCF293297cb935d3CA'
const LEADERBOARD_ABI = [
    {
      "inputs": [
        { "internalType": "uint256", "name": "_won", "type": "uint256" },
        { "internalType": "uint256", "name": "_lost", "type": "uint256" }
      ],
      "name": "recordResult",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [ { "internalType": "address", "name": "", "type": "address" } ],
      "name": "userStats",
      "outputs": [
        { "internalType": "uint256", "name": "sessionsPlayed", "type": "uint256" },
        { "internalType": "uint256", "name": "totalGains", "type": "uint256" },
        { "internalType": "uint256", "name": "totalLosses", "type": "uint256" },
        { "internalType": "int256", "name": "netProfit", "type": "int256" },
        { "internalType": "uint256", "name": "lastUpdate", "type": "uint256" }
      ],
      "stateMutability": "view",
      "type": "function"
    }
];

const app = {
    state: {
        currentView: 'home',
        isConnected: false,
        walletAddress: null,
        balance: '0.00',
        lastBalance: 0,
        username: 'Guest',
        winRate: '0%',
        isProcessingBet: false,
        lastBalanceFetch: 0,
        refreshInterval: null,
        gamingStats: {
            totalWins: 0,
            totalLosses: 0,
            netProfit: 0,
            sessions: 0
        }
    },

    getSafeChainId() {
        return 296; // Hedera Testnet
    },

    async init() {
        console.log('[PLAYFI] App initializing...');
        
        this.updateUI();
        modal.subscribeAccount((account) => {
            if (account.isConnected && account.address && !this.state.isConnected) {
                console.log("[PLAYFI] Reown Account Connected:", account.address);
                this.state.username = `${account.address.substring(0, 6)}...${account.address.substring(account.address.length - 4)}`;
                this.handleConnect(account.address);
            } else if (!account.isConnected && this.state.isConnected) {
                console.log("[PLAYFI] Reown Account Disconnected");
                this.handleDisconnect();
            }
        });

        setTimeout(() => {
            try {
                const acc = getAccount(wagmiAdapter.wagmiConfig);
                if (acc && acc.isConnected && acc.address && !this.state.isConnected) {
                    this.state.username = `${acc.address.substring(0, 6)}...${acc.address.substring(acc.address.length - 4)}`;
                    this.handleConnect(acc.address);
                }
            } catch(e) {}
        }, 1000);

        await initWallet();
        
        const refreshBtn = document.getElementById('refresh-balance-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshBalance(true);
            });
        }

        this.navigate('home');
    },

    navigate(view) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('section-active');
            v.classList.add('hidden');
        });
        
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('section-active');
            window.scrollTo(0, 0);
        }

        if (view === 'vault' && window.vaultManager) {
            window.vaultManager.refreshBalance();
        }
    },

    connectWallet() {
        connectWallet(); 
    },

    async handleConnect(address) {
        if (!address) return;
        this.state.isConnected = true;
        this.state.walletAddress = address.toLowerCase();
        
        try {
            const baseUrl = 'https://testnet.mirrornode.hedera.com';
            const response = await fetch(`${baseUrl}/api/v1/accounts/${this.state.walletAddress}`);
            const data = await response.json();
            
            if (data && data.account) {
                this.state.username = data.account;
                if (data.balance && typeof data.balance.balance === 'number') {
                    const hbarBalance = data.balance.balance / 100_000_000;
                    this.state.balance = hbarBalance.toFixed(2);
                    this.state.lastBalance = hbarBalance;
                }
                this.updateUI();
                
                if (window.vaultManager) {
                    window.vaultManager.refreshBalance();
                }
            }
        } catch (err) {
            console.error('[PLAYFI] handleConnect Error:', err);
        }

        await this.refreshBalance();
        this.startAutoRefresh();
        
        // Dispatch custom event for vault manager
        window.dispatchEvent(new CustomEvent('walletConnected'));
    },

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.state.refreshInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.refreshBalance(false);
            }
        }, 10000);
    },

    stopAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
            this.state.refreshInterval = null;
        }
    },

    async refreshBalance(isManual = false) {
        if (!this.state.walletAddress || !this.state.isConnected) return;
        
        const now = Date.now();
        if (!isManual && now - this.state.lastBalanceFetch < 5000) return;

        try {
            const baseUrl = 'https://testnet.mirrornode.hedera.com';
            const queryParam = (this.state.username && this.state.username.startsWith('0.0.')) ? this.state.username : this.state.walletAddress;
            const response = await fetch(`${baseUrl}/api/v1/accounts/${queryParam}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.balance && typeof data.balance.balance === 'number') {
                    const hbarBalance = data.balance.balance / 100_000_000;
                    this.state.lastBalanceFetch = Date.now();
                    this.state.balance = hbarBalance.toFixed(2);
                    this.state.lastBalance = hbarBalance;
                }
            }
        } catch (error) {
            console.error('[PLAYFI] Balance fetch error:', error);
        } finally {
            this.updateUI();
        }
    },

    async processBet(amount) {
        if (!this.state.isConnected || this.state.isProcessingBet) return false;
        
        const vaultBalance = parseFloat(window.vaultManager?.state.vaultBalance || 0);
        if (amount > vaultBalance) {
            this.showToast('Insufficient Vault balance! Please deposit HBAR in the Vault.', 'error');
            this.navigate('vault');
            return false;
        }

        this.state.isProcessingBet = true;
        this.showTxOverlay('Confirming Bet', 'Sending 1 HBAR to the house...');
        
        try {
            const hash = await sendTransaction(wagmiAdapter.wagmiConfig, {
                to: HOUSE_ADDRESS,
                value: parseEther(amount.toString())
            });
            
            this.showTxOverlay('Transaction Pending', 'Waiting for Hedera confirmation...');
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            this.hideTxOverlay();
            this.showToast('Bet confirmed! Good luck!', 'success');
            
            this.state.isProcessingBet = false;
            return hash; 
        } catch (error) {
            console.error('[PLAYFI] Bet Transaction Error:', error);
            this.hideTxOverlay();
            this.showToast(error.shortMessage || error.message || 'Transaction failed', 'error');
            this.state.isProcessingBet = false;
            return null;
        }
    },

    showTxOverlay(title, desc) {
        const overlay = document.getElementById('tx-overlay');
        const titleEl = document.getElementById('tx-status-title');
        const descEl = document.getElementById('tx-status-desc');
        if (overlay && titleEl && descEl) {
            titleEl.innerText = title;
            descEl.innerText = desc;
            overlay.classList.remove('hidden');
        }
    },

    hideTxOverlay() {
        const overlay = document.getElementById('tx-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    handleDisconnect() {
        this.state.isConnected = false;
        this.state.walletAddress = null;
        this.state.balance = '0.00';
        this.stopAutoRefresh();
        this.updateUI();
    },

    updateUI() {
        const connectBtn = document.getElementById('connect-btn');
        const userProfile = document.getElementById('user-profile');
        const userBalanceEl = document.getElementById('user-balance');
        const profileUsernameEl = document.getElementById('profile-username');

        if (this.state.isConnected) {
            if (connectBtn) connectBtn.classList.add('hidden');
            if (userProfile) userProfile.classList.remove('hidden');
            if (userBalanceEl) userBalanceEl.innerText = this.state.balance;
            if (profileUsernameEl) profileUsernameEl.innerText = this.state.username;
        } else {
            if (connectBtn) connectBtn.classList.remove('hidden');
            if (userProfile) userProfile.classList.add('hidden');
        }
    },

    showToast(message, type = 'default') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => app.init());
