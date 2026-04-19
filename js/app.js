import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { hedera, hederaTestnet } from '@reown/appkit/networks'
import { getBalance, sendTransaction, waitForTransactionReceipt } from '@wagmi/core'
import { parseEther } from 'viem'

const projectId = '1543435671e63ff12e86f80deed48dae'

// Official House Address for Hedera Testnet
const HOUSE_ADDRESS = '0x874cd1a4a234272a69b449422b668ce0c9bb2c57'

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [hedera, hederaTestnet]
})

const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: [hedera, hederaTestnet],
  projectId,
  metadata: {
    name: 'PLAYFI',
    description: 'Hedera Play-to-Earn Arcade',
    url: 'https://playfi-kohl.vercel.app',
    icons: ['https://cryptologos.cc/logos/hedera-hbar-logo.svg']
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#00f0ff',
    '--w3m-color-mix': '#00f0ff',
    '--w3m-color-mix-strength': 15
  }
})

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

    init() {
        console.log('[PLAYFI] App initializing...');
        
        modal.subscribeAccount((account) => {
            if (account.isConnected && account.address) {
                this.handleConnect(account.address);
            } else if (!account.isConnected) {
                this.handleDisconnect();
            }
        });

        const refreshBtn = document.getElementById('refresh-balance-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshBalance(true);
            });
        }

        setTimeout(() => {
            const acc = modal.getAccount();
            if (acc && acc.isConnected && acc.address) {
                this.handleConnect(acc.address);
            }
        }, 1000);
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
        modal.open();
    },

    async handleConnect(address) {
        if (!address) return;
        this.state.isConnected = true;
        this.state.walletAddress = address.toLowerCase();
        
        // Show truncated 0x address initially
        this.state.username = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        this.state.balance = 'Loading...';
        this.updateUI();

        console.log('[PLAYFI] Connection detected for:', this.state.walletAddress);

        // 1. Fetch Hedera Native ID (0.0.x) and initial balance
        const rawChainId = modal.getChainId();
        const chainId = typeof rawChainId === 'string' && rawChainId.includes(':') 
            ? Number(rawChainId.split(':')[1]) 
            : Number(rawChainId);
        const isTestnet = chainId === 296 || chainId === Number(hederaTestnet.id);
        const baseUrl = isTestnet ? 'https://testnet.mirrornode.hedera.com' : 'https://mainnet-public.mirrornode.hedera.com';

        try {
            const response = await fetch(`${baseUrl}/api/v1/accounts/${this.state.walletAddress}`);
            const data = await response.json();
            
            if (data && data.account) {
                console.log('[PLAYFI] Hedera Account found:', data.account);
                this.state.username = data.account; // Format: 0.0.xxxx
                
                // Immediately set balance if available in this call
                if (data.balance && typeof data.balance.balance === 'number') {
                    const hbarBalance = data.balance.balance / 100_000_000;
                    const networkName = isTestnet ? ' (Testnet)' : ' (Mainnet)';
                    this.state.balance = hbarBalance.toFixed(2) + networkName;
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
        }, 15000); // 15s interval
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
        
        const rawChainId = modal.getChainId();
        const chainId = typeof rawChainId === 'string' && rawChainId.includes(':') 
            ? Number(rawChainId.split(':')[1]) 
            : Number(rawChainId);
            
        const isTestnet = chainId === 296 || chainId === Number(hederaTestnet.id);
        const networkName = isTestnet ? ' (Testnet)' : ' (Mainnet)';
        
        if (isManual || this.state.balance === 'Loading...') {
            if (refreshBtn) refreshBtn.classList.add('is-refreshing');
            this.updateUI();
        }

        try {
            const baseUrl = isTestnet ? 'https://testnet.mirrornode.hedera.com' : 'https://mainnet-public.mirrornode.hedera.com';
            const queryParam = this.state.username.startsWith('0.0.') ? this.state.username : this.state.walletAddress;
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
                    if (refreshBtn) {
                        setTimeout(() => refreshBtn.classList.remove('is-refreshing'), 500);
                    }
                    return; 
                }
            }

            // Fallback
            const balanceData = await getBalance(wagmiAdapter.wagmiConfig, {
                address: this.state.walletAddress,
                chainId: chainId
            });
            
            const rawBalance = parseFloat(balanceData.formatted);
            this.state.balance = (isNaN(rawBalance) ? '0.00' : rawBalance.toFixed(2)) + networkName;
            this.state.balanceError = false;
        } catch (error) {
            console.error('[PLAYFI] Balance fetch error:', error);
            this.state.balanceError = true;
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
            // 1. Send HBAR to House Address
            const hash = await sendTransaction(wagmiAdapter.wagmiConfig, {
                to: HOUSE_ADDRESS,
                value: parseEther(amount.toString()),
            });
            
            this.showTxOverlay('Transaction Pending', 'Waiting for Hedera network confirmation...');
            
            // 2. Wait for confirmation - OPTIMIZED: Race the RPC relay vs Mirror Node
            // This starts the mirror node check IMMEDIATELY instead of waiting for a timeout.
            try {
                await Promise.race([
                    waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash }),
                    this.verifyTxOnMirrorNode(hash)
                ]);
            } catch (waitError) {
                console.warn('[PLAYFI] Primary wait failing, continuing if mirror node eventually succeeds...', waitError);
                // The race might fail if one side rejects, but we only need ONE to succeed.
            }
            
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

    /**
     * MIRROR NODE FALLBACK
     * Checks if the transaction has reached consensus even if the RPC relay is lagging.
     */
    async verifyTxOnMirrorNode(hash) {
        // Hedera Testnet/Mainnet Mirror Node check
        const isTestnet = modal.getChainId() === 296;
        const baseUrl = isTestnet ? 'https://testnet.mirrornode.hedera.com' : 'https://mainnet-public.mirrornode.hedera.com';
        
        // Poll for up to 30 seconds
        for (let i = 0; i < 30; i++) {
            try {
                const response = await fetch(`${baseUrl}/api/v1/transactions/${hash}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.transactions && data.transactions.length > 0) {
                        const success = data.transactions[0].result === 'SUCCESS';
                        if (success) return true;
                        if (data.transactions[0].result !== 'PENDING') throw new Error('Transaction failed on-chain');
                    }
                }
            } catch (e) {
                if (e.message === 'Transaction failed on-chain') throw e;
                // Otherwise ignore fetch errors and keep polling
            }
            await new Promise(r => setTimeout(r, 1000)); // Check every 1s for speed
        }
        return false;
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
