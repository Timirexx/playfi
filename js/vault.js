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
        tierName: 'Base',
        tierMult: '1.0x',
        timeHeld: '0 Days',
        isAssociated: true,
        isProcessing: false,
        lastFetchTime: 0
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

            // Fetch User Stake Info (struct returns: [amount, lastClaimTs, firstDepositTs])
            const stakeRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'stakes',
                args: [userAddress]
            });
            const stakedAmountIdxZero = stakeRaw[0] || 0n;
            this.state.stakedBalance = parseFloat(formatUnits(stakedAmountIdxZero, 8)).toFixed(2);
            
            // Calculate Loyalty Tier dynamically
            const firstDepositTs = Number(stakeRaw[2] || 0n);
            if (stakedAmountIdxZero > 0n && firstDepositTs > 0) {
                const now = Math.floor(Date.now() / 1000);
                const secondsHeld = now - firstDepositTs;
                const daysHeld = Math.floor(secondsHeld / 86400);
                
                this.state.timeHeld = `${daysHeld} Day${daysHeld !== 1 ? 's' : ''}`;
                
                if (secondsHeld >= 14 * 86400) {
                    this.state.tierName = 'Diamond';
                    this.state.tierMult = '2.0x';
                } else if (secondsHeld >= 7 * 86400) {
                    this.state.tierName = 'Gold';
                    this.state.tierMult = '1.5x';
                } else if (secondsHeld >= 3 * 86400) {
                    this.state.tierName = 'Silver';
                    this.state.tierMult = '1.2x';
                } else {
                    this.state.tierName = 'Base';
                    this.state.tierMult = '1.0x';
                }
            } else {
                this.state.timeHeld = '0 Days';
                this.state.tierName = 'Base';
                this.state.tierMult = '1.0x';
            }

            // Fetch PlayFi Points (HTS token + Transaction Bonus)
            const yieldRaw = await readContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'calculateYield',
                args: [userAddress]
            });
            this.state.earnedPlay = parseFloat(formatUnits(yieldRaw, 8)).toFixed(2);
            this.state.lastFetchTime = Date.now();
            // Dynamism: Every fetch provides a fresh snapshot of your growing points balance.

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
        if (window.app) window.app.showTxOverlay('Activating System', 'Enabling PlayFi Points system in your wallet...');

        try {
            // Hedera HTS Precompile at 0x167
            // function associateToken(address account, address token)
            const HTS_PRECOMPILE = '0x0000000000000000000000000000000000000167';
            const abi = ["function associateToken(address account, address token) external returns (int32)"];
            
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: HTS_PRECOMPILE,
                abi: abi,
                functionName: 'associateToken',
                args: [window.app.state.walletAddress, PLAY_TOKEN_ADDRESS],
                gas: 800000n // Bypass gas estimation
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Finalizing association...');
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });

            this.state.isAssociated = true;
            this.fetchStats(window.app.state.walletAddress);
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Points System Activated!', 'success');
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
        if (window.app) window.app.showTxOverlay('Claiming Points', 'Collecting your generated PlayFi Points...');

        try {
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'claimYield',
                gas: 800000n // Bypass gas estimation
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Waiting for confirmation...');
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Points claimed successfully!', 'success');
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
                value: parseEther(amount.toString()), // Return to 18-decimal for EVM RPC compatibility
                gas: 800000n // Bypass gas estimation
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Waiting for Hedera confirmation...');
            
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Successfully staked HBAR & Earned Bonus Points!', 'success');
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

    openWithdrawModal() {
        if (!this.state.stakedBalance || parseFloat(this.state.stakedBalance) <= 0) {
            if (window.app) window.app.showToast('You have nothing staked to withdraw', 'error');
            return;
        }
        const modal = document.getElementById('withdraw-modal');
        const balanceDisplay = document.getElementById('modal-staked-balance');
        const input = document.getElementById('modal-withdraw-amount');
        
        if (balanceDisplay) balanceDisplay.innerText = this.state.stakedBalance;
        if (input) input.value = '';
        if (modal) modal.classList.remove('hidden');
    },

    closeWithdrawModal() {
        const modal = document.getElementById('withdraw-modal');
        if (modal) modal.classList.add('hidden');
    },

    async withdraw(amount) {
        if (this.state.isProcessing || !amount || amount <= 0) return;
        if (parseFloat(amount) > parseFloat(this.state.stakedBalance)) {
            if (window.app) window.app.showToast('Amount exceeds staked balance', 'error');
            return;
        }
        this.state.isProcessing = true;
        this.closeWithdrawModal(); // Hide modal when processing starts
        
        if (window.app) window.app.showTxOverlay('Partial Withdrawal', `Withdrawing ${amount} HBAR and claiming points...`);

        try {
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'withdrawAmount',
                args: [parseUnits(amount.toString(), 8)],
                gas: 800000n // Bypass gas estimation
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Finalizing withdrawal...');
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Successfully withdrawn HBAR!', 'success');
                window.app.refreshBalance(true);
                this.fetchStats(window.app.state.walletAddress);
            }
        } catch (error) {
            console.error('[VAULT] Partial Withdraw Error:', error);
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast(error.shortMessage || error.message || 'Withdrawal failed', 'error');
            }
        } finally {
            this.state.isProcessing = false;
        }
    },

    async withdrawAll() {
        if (this.state.isProcessing || parseFloat(this.state.stakedBalance) <= 0) return;
        this.state.isProcessing = true;
        
        if (window.app) window.app.showTxOverlay('Vault Unstaking', 'Emptying vault and claiming all points...');

        try {
            const hash = await writeContract(wagmiAdapter.wagmiConfig, {
                address: PLAYFI_VAULT_ADDRESS,
                abi: PLAYFI_VAULT_ABI,
                functionName: 'withdraw',
                gas: 800000n // Bypass gas estimation
            });

            if (window.app) window.app.showTxOverlay('Transaction Pending', 'Waiting for Hedera confirmation...');
            
            await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });
            
            if (window.app) {
                window.app.hideTxOverlay();
                window.app.showToast('Withdrawn HBAR & Final Points!', 'success');
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
        
        const tierName = document.getElementById('vault-tier-name');
        const tierMult = document.getElementById('vault-tier-multiplier');
        const timeHeld = document.getElementById('vault-time-held');
        const tierIcon = document.getElementById('vault-tier-icon');
        
        if (tvlDisplay) tvlDisplay.innerText = this.state.tvl;
        if (stakedDisplay) stakedDisplay.innerText = this.state.stakedBalance;
        if (earnedDisplay) earnedDisplay.innerText = this.state.earnedPlay;
        if (walletPlayDisplay) walletPlayDisplay.innerText = this.state.playBalance;
        
        if (tierName) tierName.innerText = this.state.tierName;
        if (tierMult) tierMult.innerText = `(${this.state.tierMult})`;
        if (timeHeld) timeHeld.innerText = this.state.timeHeld;
        
        if (tierIcon) {
            if (this.state.tierName === 'Diamond') tierIcon.innerText = '💎';
            else if (this.state.tierName === 'Gold') tierIcon.innerText = '🏆';
            else if (this.state.tierName === 'Silver') tierIcon.innerText = '🥈';
            else tierIcon.innerText = '⚪';
        }

        if (associateBtn) {
            if (this.state.isAssociated) {
                associateBtn.classList.add('hidden');
            } else {
                associateBtn.classList.remove('hidden');
            }
        }
        
        if(window.app) window.app.updateUI();
    },

    startVisualTick() {
        // Disabled per user request
        if (this.state.tickInterval) clearInterval(this.state.tickInterval);
    }
};

window.vaultSystem = vault;
