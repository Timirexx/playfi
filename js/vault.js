import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { parseEther, formatUnits, parseUnits } from 'viem'
import { wagmiAdapter } from '../src/wallet.js'
import { PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI, PLAY_TOKEN_ADDRESS, PLAY_TOKEN_ABI } from '../src/contracts/PlayFiVault.js'

export const vault = {
    state: {
        tvl: '0.00',
        stakedBalance: '0.00',
        earnedPlay: '0.00',
        playBalance: '0.00',
        isAssociated: true, // Default to true, we'll check
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
            this.state.tvl = parseFloat(formatUnits(tvlRaw, 8)).toFixed(2);

            // Fetch User Staked Balance (Hedera EVM uses 8 decimals for HBAR msg.value)
            const balanceRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'balances',
                args: [userAddress]
            });
            this.state.stakedBalance = parseFloat(formatUnits(balanceRaw, 8)).toFixed(2);

            // Fetch Earned PLAY Yield (PLAY is 8 decimals)
            const yieldRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'calculateYield',
                args: [userAddress]
            });
            this.state.earnedPlay = parseFloat(formatUnits(yieldRaw, 8)).toFixed(4);

            // Fetch Wallet PLAY Token Balance 
            try {
                const playRaw = await readContract(wagmiAdapter.wagmiConfig, {
                    address: PLAY_TOKEN_ADDRESS,
                    abi: PLAY_TOKEN_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                });
                this.state.playBalance = parseFloat(formatUnits(playRaw, 8)).toFixed(2);
                this.state.isAssociated = true;
            } catch (e) {
                // If balanceOf fails on Hedera for an HTS token, it often means the account is not associated
                console.warn('[VAULT] Balance fetch failed, user might not be associated');
                this.state.playBalance = '0.00';
                this.state.isAssociated = false;
            }

            if(window.app) window.app.state.playBalance = this.state.playBalance;

            this.updateUI();
        } catch (error) {
            console.error('[VAULT] Error fetching stats:', error);
        }
    },

    /**
     * Hedera HTS Requirement: Associate user account with the PLAY token
     */
    async associate() {
        if (this.state.isProcessing) return;
        this.state.isProcessing = true;

        if (window.app) window.app.showTxOverlay('Activating Token', 'Please associate the PLAY token in your wallet...');

        try {
            // Hedera HTS Precompile at 0x167
            // function associateToken(address account, address token)
            const HTS_PRECOMPILE = '0x0000000000000000000000000000000000000167';
            const abi = ["function associateToken(address account, address token) external returns (int32)"];
            
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: HTS_PRECOMPILE,
                abi: abi,
                functionName: 'associateToken',
                args: [window.app.state.walletAddress, PLAY_TOKEN_ADDRESS]
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Finalizing association...');
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });

            this.state.isAssociated = true;
            this.fetchStats(window.app.state.walletAddress);
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('PLAY Token Activated!', 'success');
            }
        } catch (error) {
            console.error('[VAULT] Association Error:', error);
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Activation failed. Please try again.', 'error');
            }
        } finally {
            this.state.isProcessing = false;
            this.updateUI();
        }
    },

    async claimYield() {
        if (!this.state.isAssociated) {
            this.associate();
            return;
        }
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
                window.app.showToast(error.shortMessage || error.message || 'Claim failed. Ensure you are associated.', 'error');
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
        const associateBtn = document.getElementById('vault-associate-btn');
        
        if (tvlDisplay) tvlDisplay.innerText = this.state.tvl;
        if (stakedDisplay) stakedDisplay.innerText = this.state.stakedBalance;
        if (earnedDisplay) earnedDisplay.innerText = this.state.earnedPlay;
        if (walletPlayDisplay) walletPlayDisplay.innerText = this.state.playBalance;

        if (associateBtn) {
            if (this.state.isAssociated) {
                associateBtn.classList.add('hidden');
            } else {
                associateBtn.classList.remove('hidden');
            }
        }
        
        if(window.app) window.app.updateUI();
    }
};

window.vaultSystem = vault;
