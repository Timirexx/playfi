import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { parseEther, formatEther } from 'viem'
import { wagmiAdapter } from '../src/wallet.js'
import { PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI } from '../src/contracts/PlayFiVault.js'

export const vault = {
    state: {
        tvl: '0.00',
        stakedBalance: '0.00',
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

            // Fetch User Balance
            const balanceRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'balances',
                args: [userAddress]
            });
            this.state.stakedBalance = parseFloat(formatEther(balanceRaw)).toFixed(2);

            this.updateUI();
        } catch (error) {
            console.error('[VAULT] Error fetching stats:', error);
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
                // Refresh app balance and vault stats
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
                window.app.showToast('Successfully withdrawn HBAR!', 'success');
                // Refresh app balance and vault stats
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
        
        if (tvlDisplay) tvlDisplay.innerText = this.state.tvl;
        if (stakedDisplay) stakedDisplay.innerText = this.state.stakedBalance;
    }
};

window.vaultSystem = vault;
