import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { parseEther, formatEther } from 'viem'
import { wagmiAdapter } from '../src/wallet.js'
import { PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI, PLAY_TOKEN_ADDRESS, PLAY_TOKEN_ABI } from '../src/contracts/PlayFiVault.js'

export const vault = {
    state: {
        tvl: '0.00',
        stakedBalance: '0.00',
        earnedPlay: '0.00',
        playBalance: '0.00',
        isProcessing: false
    },

    async fetchStats(userAddress) {
        if (!userAddress) return;

        try {
            // Fetch TVL
            const tvlRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'totalValueLocked',
            });
            this.state.tvl = parseFloat(formatEther(tvlRaw)).toFixed(2);

            // Fetch User Staked Balance
            const balanceRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'balances',
                args: [userAddress]
            });
            this.state.stakedBalance = parseFloat(formatEther(balanceRaw)).toFixed(2);

            // Fetch Earned PLAY Yield
            const yieldRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'calculateYield',
                args: [userAddress]
            });
            this.state.earnedPlay = parseFloat(formatEther(yieldRaw)).toFixed(4);

            // Fetch Wallet PLAY Token Balance 
            const playRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAY_TOKEN_ADDRESS,
                abi: PLAY_TOKEN_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            });
            this.state.playBalance = parseFloat(formatEther(playRaw)).toFixed(2);

            if(window.app) window.app.state.playBalance = this.state.playBalance;

            this.updateUI();
        } catch (error) {
            console.error('[VAULT] Error fetching stats:', error);
        }
    },

    async claimYield() {
        if (this.state.isProcessing || parseFloat(this.state.earnedPlay) <= 0) return;
        this.state.isProcessing = true;
        
        if (window.app) window.app.showTxOverlay('Claiming Yield', 'Please confirm in your wallet...');

        try {
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'claimYield'
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Waiting for confirmation...');
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Successfully claimed PLAY tokens!', 'success');
                this.fetchStats(window.app.state.walletAddress);
                window.app.updateUI();
            }
        } catch (error) {
            console.error('[VAULT] Claim Error:', error);
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast(error.shortMessage || error.message || 'Claim failed', 'error');
            }
        } finally {
            this.state.isProcessing = false;
        }
    },

    async deposit(amount) {
        if (this.state.isProcessing || !amount || amount <= 0) return;
        this.state.isProcessing = true;
        
        if (window.app) window.app.showTxOverlay('Vault Staking', 'Please confirm the deposit in your wallet...');

        try {
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'deposit',
                value: parseEther(amount.toString())
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Waiting for Hedera confirmation...');
            
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Successfully staked HBAR!', 'success');
                window.app.refreshBalance(true);
                this.fetchStats(window.app.state.walletAddress);
            }
        } catch (error) {
            console.error('[VAULT] Deposit Error:', error);
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast(error.shortMessage || error.message || 'Deposit failed', 'error');
            }
        } finally {
            this.state.isProcessing = false;
        }
    },

    async withdraw() {
        if (this.state.isProcessing || parseFloat(this.state.stakedBalance) <= 0) return;
        this.state.isProcessing = true;
        
        if (window.app) window.app.showTxOverlay('Vault Unstaking', 'Please confirm the withdrawal in your wallet...');

        try {
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'withdraw'
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Waiting for Hedera confirmation...');
            
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Successfully withdrawn HBAR & Yield!', 'success');
                window.app.refreshBalance(true);
                this.fetchStats(window.app.state.walletAddress);
            }
        } catch (error) {
            console.error('[VAULT] Withdraw Error:', error);
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast(error.shortMessage || error.message || 'Withdrawal failed', 'error');
            }
        } finally {
            this.state.isProcessing = false;
        }
    },

    updateUI() {
        const tvlDisplay = document.getElementById('vault-tvl');
        const stakedDisplay = document.getElementById('vault-staked');
        const earnedDisplay = document.getElementById('vault-earned-play');
        const walletPlayDisplay = document.getElementById('wallet-play-balance');
        
        if (tvlDisplay) tvlDisplay.innerText = this.state.tvl;
        if (stakedDisplay) stakedDisplay.innerText = this.state.stakedBalance;
        if (earnedDisplay) earnedDisplay.innerText = this.state.earnedPlay;
        if (walletPlayDisplay) walletPlayDisplay.innerText = this.state.playBalance;
        
        if(window.app) window.app.updateUI();
    }
};

window.vaultSystem = vault;
