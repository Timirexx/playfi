import { initWallet, connectWallet, hashconnect } from '../src/wallet.js'

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
        
        // 1. Setup HashConnect Listeners (Single Source of Truth)
        hashconnect.pairingEvent.on((msg) => {
            console.log("[HashConnect] Pairing Resolved", msg);
            if (msg.pairingData) {
                const accountId = msg.pairingData.accountIds[0];
                const evmAddress = msg.pairingData.accounts[0].evmAddress || accountId;
                
                // Immediately set natived ID and trigger connect logic
                this.state.username = accountId; 
                this.handleConnect(evmAddress);
            }
        });

        hashconnect.disconnectionEvent.on((msg) => {
            console.log("[HashConnect] Wallet Disconnected");
            this.handleDisconnect();
        });

        // 2. Button Loading State
        const connectBtns = document.querySelectorAll('#connect-btn, .lock-overlay .btn');
        connectBtns.forEach(btn => {
            btn.disabled = true;
            btn.innerText = "Loading SDK...";
        });

        // 3. Initialize HashConnect
        const isSDKReady = await initWallet();
        
        connectBtns.forEach(btn => {
            btn.disabled = !isSDKReady;
            btn.innerText = isSDKReady ? "Connect Wallet" : "SDK Error";
        });
        
        // 4. Hook up the UI refresh button
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

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.innerText.toLowerCase().includes(viewId.toLowerCase())) {
                btn.classList.add('active');
            }
        });
    },

    openWalletModal() {
        console.log('[PLAYFI] Wallet connection triggered');
        connectWallet(); 
    },

    async handleConnect(address) {
        if (!address) return;
        this.state.isConnected = true;
        this.state.walletAddress = address.toLowerCase();
        
        // Show truncated 0x address initially if not already set to a native Hedera ID
        if (this.state.username === 'Guest' || !this.state.username.startsWith('0.0.')) {
            this.state.username = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        }
        this.state.balance = 'Loading...';
        this.updateUI();

        console.log('[PLAYFI] Connection detected for:', this.state.walletAddress);

        try {
            // Network is firmly locked to Hedera Testnet
            const isTestnet = true;
            const baseUrl = 'https://testnet.mirrornode.hedera.com';

            console.log(`[PLAYFI] Fetching account details from Testnet...`);
            
            const response = await fetch(`${baseUrl}/api/v1/accounts/${this.state.walletAddress}`);
            const data = await response.json();
            
            if (data && data.account) {
                console.log('[PLAYFI] Hedera Native ID found:', data.account);
                this.state.username = data.account; // Store 0.0.xxxx
                
                if (data.balance && typeof data.balance.balance === 'number') {
                    const hbarBalance = data.balance.balance / 100_000_000;
                    const networkName = isTestnet ? ' HBAR (Testnet)' : ' HBAR (Mainnet)';
                    this.state.balance = hbarBalance.toFixed(2) + networkName;
                    this.state.lastBalance = hbarBalance;
                }
                this.updateUI();
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

    /**
     * PROCESS ON-CHAIN BET
     * This prompts the user to send HBAR to the house address before starting the game.
     */
    async processBet(amount) {
        if (!this.state.isConnected || this.state.isProcessingBet) return false;
        
        this.state.isProcessingBet = true;
        this.showTxOverlay('Action Required', 'Please confirm the bet in your wallet...');
        
        try {
            // TODO: Construct Hedera TransferTransaction via HashConnect
            console.log('[PLAYFI] Simulated bet of', amount, 'HBAR');
            await new Promise(r => setTimeout(r, 1500));
            
            this.hideTxOverlay();
            this.showToast('Bet confirmed! Good luck!', 'success');
            await this.refreshBalance();
            this.state.isProcessingBet = false;
            return true;
        } catch (error) {
            console.error('[PLAYFI] Bet Transaction Error:', error);
            this.hideTxOverlay();
            this.showToast('Transaction failed', 'error');
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
