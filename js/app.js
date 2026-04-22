import { initWallet, connectWallet, modal, wagmiAdapter } from '../src/wallet.js'
import { getAccount, sendTransaction, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { parseUnits, parseEther } from 'viem'
import { PLAY_TOKEN_ADDRESS, PLAY_TOKEN_ABI } from '../src/contracts/PlayFiVault.js'

// Official House Address for Hedera Testnet
const HOUSE_ADDRESS = '0x874cd1a4a234272a69b449422b668ce0c9bb2c57'

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
        refreshInterval: null
    },

    getSafeChainId() {
        return 296; // Hedera Testnet
    },

    async init() {
        console.log('[PLAYFI] App initializing...');
        
        // 1. Setup Reown AppKit Listeners
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

        // Initial State Check
        setTimeout(() => {
            try {
                const acc = getAccount(wagmiAdapter.wagmiConfig);
                if (acc && acc.isConnected && acc.address && !this.state.isConnected) {
                    console.log("[PLAYFI] Picked up initial Reown state.");
                    this.state.username = `${acc.address.substring(0, 6)}...${acc.address.substring(acc.address.length - 4)}`;
                    this.handleConnect(acc.address);
                }
            } catch(e) {}
        }, 1000);

        // 2. Initialize AppKit Wrapper
        const isSDKReady = await initWallet();
        
        // 3. Hook up the UI refresh button
        const refreshBtn = document.getElementById('refresh-balance-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshBalance(true);
            });
        }
    },

    navigate(viewId) {
        document.querySelectorAll('.view').forEach(el => {
            el.classList.remove('section-active');
            el.classList.add('hidden');
        });
        
        let targetView = document.getElementById(`view-${viewId}`);
        if (!targetView) {
            targetView = document.getElementById('view-placeholder');
            document.getElementById('placeholder-title').innerText = viewId.toUpperCase();
        }

        targetView.classList.remove('hidden');
        targetView.classList.add('section-active');

        // Sync Desktop Nav
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.innerText.toLowerCase().includes(viewId.toLowerCase())) {
                btn.classList.add('active');
            }
        });

        // Sync Mobile Nav
        document.querySelectorAll('.mobile-nav-item').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('onclick')?.includes(`'${viewId}'`)) {
                btn.classList.add('active');
            }
        });

        // Trigger Vault Stats if needed
        if (viewId === 'vault' && this.state.isConnected && window.vaultSystem) {
            window.vaultSystem.fetchStats(this.state.walletAddress);
        }
    },

    openWalletModal() {
        console.log('[PLAYFI] Wallet connection triggered');
        connectWallet(); 
    },

    async handleConnect(address) {
        if (!address) return;
        this.state.isConnected = true;
        this.state.walletAddress = address.toLowerCase();
        
        console.log('[PLAYFI] Connection detected for:', this.state.walletAddress);
        
        try {
            const baseUrl = 'https://testnet.mirrornode.hedera.com';
            console.log(`[PLAYFI] Fetching Hedera Native ID via Mirror Node...`);
            
            const response = await fetch(`${baseUrl}/api/v1/accounts/${this.state.walletAddress}`);
            const data = await response.json();
            
            if (data && data.account) {
                console.log('[PLAYFI] Hedera Native ID found:', data.account);
                this.state.username = data.account; // Store 0.0.xxxx
                
                if (data.balance && typeof data.balance.balance === 'number') {
                    const hbarBalance = data.balance.balance / 100_000_000;
                    const networkName = ' HBAR (Testnet)';
                    this.state.balance = hbarBalance.toFixed(2) + networkName;
                    this.state.lastBalance = hbarBalance;
                }
                this.updateUI();
                
                // Fetch Vault stats if user is connected
                if (window.vaultSystem) {
                    window.vaultSystem.fetchStats(this.state.walletAddress);
                }
            }
        } catch (err) {
            console.error('[PLAYFI] handleConnect Mirror Node Error:', err);
        }

        await this.refreshBalance();
        this.startAutoRefresh();
    },

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.state.refreshInterval = setInterval(() => {
            // Only refresh if tab is active to save bandwidth
            if (document.visibilityState === 'visible') {
                this.refreshBalance(false);
            }
        }, 10000); // 10s auto-refresh interval
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
        // Cache: Don't fetch more than once every 5 seconds unless manual
        if (!isManual && now - this.state.lastBalanceFetch < 5000) return;

        const balanceEl = document.getElementById('user-balance');
        const refreshBtn = document.getElementById('refresh-balance-btn');
        
        // Safe network
        const isTestnet = true;
        const networkName = ' HBAR (Testnet)';
        
        if (isManual || this.state.balance === 'Loading...') {
            if (refreshBtn) refreshBtn.classList.add('is-refreshing');
            this.updateUI();
        }

        try {
            const baseUrl = 'https://testnet.mirrornode.hedera.com';
            
            // Prioritize Account ID (0.0.x)
            const queryParam = (this.state.username && this.state.username.startsWith('0.0.')) 
                ? this.state.username 
                : this.state.walletAddress;
                
            const response = await fetch(`${baseUrl}/api/v1/accounts/${queryParam}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.balance && typeof data.balance.balance === 'number') {
                    const hbarBalance = data.balance.balance / 100_000_000;
                    this.state.lastBalanceFetch = Date.now();
                    
                    if (parseFloat(this.state.balance) !== hbarBalance) {
                        this.animateBalance(hbarBalance, isTestnet);
                    } else {
                        this.state.balance = hbarBalance.toFixed(2) + networkName;
                        this.updateUI();
                    }
                    
                    this.state.balanceError = false;
                    console.log(`[PLAYFI] Balance synced via Native ID (${queryParam}):`, hbarBalance);
                    if (refreshBtn) {
                        setTimeout(() => refreshBtn.classList.remove('is-refreshing'), 500);
                    }
                    return; 
                }
            } else {
                throw new Error('Mirror node returned error status');
            }
        } catch (error) {
            console.error('[PLAYFI] Balance fetch error:', error);
            this.state.balance = 'Unable to fetch balance';
            this.state.balanceError = true;
            if (isManual) this.showToast('Failed to sync balance. Click 🔄 to retry.', 'error');
        } finally {
            if (refreshBtn) {
                setTimeout(() => refreshBtn.classList.remove('is-refreshing'), 500);
            }
            this.updateUI();
        }
    },

    animateBalance(newVal, isTestnet) {
        const balanceEl = document.getElementById('user-balance');
        if (!balanceEl) return;

        const startVal = this.state.lastBalance || parseFloat(this.state.balance) || 0;
        const duration = 800;
        const startTime = performance.now();
        const networkName = isTestnet ? ' (Testnet)' : ' (Mainnet)';

        // Animation class
        const animClass = newVal > startVal ? 'balance-update-up' : 'balance-update-down';
        balanceEl.classList.add(animClass);

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (outQuart)
            const easedProgress = 1 - Math.pow(1 - progress, 4);
            const currentBalance = startVal + (newVal - startVal) * easedProgress;
            
            this.state.balance = currentBalance.toFixed(2) + networkName;
            balanceEl.innerText = this.state.balance;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                this.state.lastBalance = newVal;
                setTimeout(() => balanceEl.classList.remove(animClass), 1000);
            }
        };

        requestAnimationFrame(update);
    },

    async processBet(amount) {
        if (!this.state.isConnected || this.state.isProcessingBet) return false;
        
        // Check HBAR balance
        const currentHbar = this.state.lastBalance || parseFloat(this.state.balance) || 0;
        if (amount > currentHbar) {
            this.showToast('Insufficient HBAR balance!', 'error');
            return false;
        }

        this.state.isProcessingBet = true;
        this.showTxOverlay('Action Required', 'Please confirm the bet in your wallet...');
        
        try {
            // Send HBAR wager to house
            const hash = await sendTransaction(wagmiAdapter.wagmiConfig, {
                to: HOUSE_ADDRESS,
                value: parseEther(amount.toString()) // Keep parseEther for 18-decimal HBAR EVM wrapping
            });
            
            this.showTxOverlay('Transaction Pending', 'Waiting for Hedera network confirmation...');
            
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            this.hideTxOverlay();
            this.showToast('Bet confirmed! Good luck!', 'success');
            await this.refreshBalance();
            this.state.isProcessingBet = false;
            return true;
        } catch (error) {
            console.error('[PLAYFI] Bet Transaction Error:', error);
            this.hideTxOverlay();
            
            const msg = error.shortMessage || error.message || 'Transaction failed or rejected';
            this.showToast(msg, 'error');
            
            this.state.isProcessingBet = false;
            return false;
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
        const appContainer = document.getElementById('app-container');

        if (this.state.isConnected) {
            if (connectBtn) connectBtn.classList.add('hidden');
            if (userProfile) userProfile.classList.remove('hidden');
            if (userBalanceEl) {
                userBalanceEl.innerText = this.state.balance;
                userBalanceEl.style.color = this.state.balanceError ? 'var(--danger)' : 'var(--neon-blue)';
            }
            if (profileUsernameEl) profileUsernameEl.innerText = this.state.username;
            if (appContainer) {
                appContainer.classList.remove('is-locked');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('game-locked'));
            }
        } else {
            if (connectBtn) connectBtn.classList.remove('hidden');
            if (userProfile) userProfile.classList.add('hidden');
            if (appContainer) {
                appContainer.classList.add('is-locked');
                document.querySelectorAll('.view').forEach(v => v.classList.add('game-locked'));
            }
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

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
