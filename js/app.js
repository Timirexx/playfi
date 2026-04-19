const app = {
    state: {
        currentView: 'home',
        isConnected: false,
        walletAddress: null,
        balance: 0.00,
        username: 'Guest',
        winRate: '0%'
    },

    init() {
        console.log('PLAYFI App Initialized');
        // Check local storage for session
        const savedSession = localStorage.getItem('playfi_session');
        if (savedSession) {
            this.state = JSON.parse(savedSession);
            this.updateUI();
        }
    },

    navigate(viewId) {
        // Handle views
        document.querySelectorAll('.view').forEach(el => {
            el.classList.remove('section-active');
            el.classList.add('hidden');
        });
        
        let targetView = document.getElementById(`view-${viewId}`);
        
        // Lazy load strategy: If the view doesn't exist, show placeholder
        if (!targetView) {
            targetView = document.getElementById('view-placeholder');
            document.getElementById('placeholder-title').innerText = viewId.toUpperCase();
            
            // Re-route to actual view if we add it dynamically later
            // Here we just simulate lazy loading
            setTimeout(() => {
                this.showToast(`Module '${viewId}' lazy loaded.`, 'success');
            }, 1000);
        }

        targetView.classList.remove('hidden');
        targetView.classList.add('section-active');

        // Update nav btns
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.innerText.toLowerCase().includes(viewId.toLowerCase())) {
                btn.classList.add('active');
            }
        });
    },

    // Wallet Integration
    openWalletModal() {
        document.getElementById('wallet-modal').classList.remove('hidden');
    },

    closeWalletModal() {
        document.getElementById('wallet-modal').classList.add('hidden');
        document.getElementById('wallet-status').classList.add('hidden');
    },

    connectWallet(provider) {
        const statusEl = document.getElementById('wallet-status');
        const statusText = document.getElementById('wallet-status-text');
        
        statusEl.classList.remove('hidden');
        statusText.innerText = `Connecting to ${provider}...`;

        // Simulate network delay / Wallet Connect flow
        setTimeout(() => {
            this.state.isConnected = true;
            this.state.walletAddress = `0x${Math.floor(Math.random() * 999999999)}...${Math.floor(Math.random() * 9999)}`;
            this.state.balance = (Math.random() * 1000 + 100).toFixed(2);
            this.state.username = `User_${this.state.walletAddress.substring(2,6)}`;
            this.state.winRate = `${Math.floor(Math.random() * 40 + 40)}%`;
            
            this.saveSession();
            this.updateUI();
            
            this.closeWalletModal();
            this.showToast(`Connected to ${provider} successfully!`, 'success');
        }, 1500);
    },

    disconnectWallet() {
        this.state.isConnected = false;
        this.state.walletAddress = null;
        this.saveSession();
        this.updateUI();
        this.showToast('Wallet disconnected.');
    },

    // UI Updates
    updateUI() {
        if (this.state.isConnected) {
            document.getElementById('connect-btn').classList.add('hidden');
            document.getElementById('user-profile').classList.remove('hidden');
            document.getElementById('user-balance').innerText = this.state.balance;
            document.getElementById('profile-username').innerText = this.state.username;
            document.querySelector('.win-rate').innerText = `${this.state.winRate} WR`;
        } else {
            document.getElementById('connect-btn').classList.remove('hidden');
            document.getElementById('user-profile').classList.add('hidden');
        }
    },

    saveSession() {
        localStorage.setItem('playfi_session', JSON.stringify(this.state));
    },

    updateBalance(amount) {
        if (!this.state.isConnected) return false;
        const newBalance = parseFloat(this.state.balance) + amount;
        if (newBalance < 0) return false; // Insufficient funds
        
        this.state.balance = newBalance.toFixed(2);
        this.updateUI();
        this.saveSession();
        return true;
    },

    // Notifications
    showToast(message, type = 'default') {
        const container = document.getElementById('toast-container');
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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
