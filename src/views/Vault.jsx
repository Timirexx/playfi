import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { useAppKitProvider } from '@reown/appkit/react';
import { PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI } from '../contracts/PlayFiVault';

const Vault = () => {
    const navigate = useNavigate();
    const { isConnected: walletConnected, address: userAddress, refreshBalance: refreshWalletBalance, updateStarPoints } = useWallet();
    const { walletProvider } = useAppKitProvider('eip155');
    const { address } = useAccount();

    const [vaultBalance, setVaultBalance] = useState("0.00");
    const [amount, setAmount] = useState("10");
    const [loading, setLoading] = useState(false);
    const [debugLog, setDebugLog] = useState([]);

    const addLog = (msg, type = 'info') => {
        console.log(`[VAULT DEBUG] ${msg}`);
        setDebugLog(prev => [`${new Date().toLocaleTimeString()} [${type}] ${msg}`, ...prev].slice(0, 10));
    };

    const [totalVaultHbar, setTotalVaultHbar] = useState("0.00");

    // --- STAKING STREAK LOGIC ---
    const [lastClaim, setLastClaim] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);

    useEffect(() => {
        if (!userAddress) return;
        const saved = localStorage.getItem(`playfi_streak_${userAddress}`);
        setLastClaim(saved ? parseInt(saved) : 0);
    }, [userAddress]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!lastClaim) {
                setTimeRemaining(0);
                return;
            }
            const now = Date.now();
            const elapsed = now - lastClaim;
            const remaining = Math.max(0, 86400000 - elapsed);
            setTimeRemaining(remaining);
        }, 1000);
        return () => clearInterval(timer);
    }, [lastClaim]);

    const formatCountdown = (ms) => {
        const totalSecs = Math.floor(ms / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleClaimStreak = () => {
        updateStarPoints(10);
        const now = Date.now();
        localStorage.setItem(`playfi_streak_${userAddress}`, now.toString());
        setLastClaim(now);
        window.dispatchEvent(new CustomEvent('showToast', { 
            detail: { message: "Claimed 10 Streak Stars! ⭐", type: 'success' } 
        }));
    };

    const fetchVaultBalance = useCallback(async () => {
        if (!userAddress) return;
        try {
            const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
            const contract = new ethers.Contract(PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI, provider);
            
            // 1. Fetch individual user balance (Native Hedera uses 8 decimals)
            const balance = await contract.userBalances(userAddress);
            const formatted = ethers.formatUnits(balance, 8);
            setVaultBalance(formatted);
            addLog(`User Balance: ${formatted} HBAR`);

            // 2. Fetch total contract balance (provider.getBalance always returns 18-decimal wei)
            const total = await provider.getBalance(PLAYFI_VAULT_ADDRESS);
            const totalFormatted = ethers.formatUnits(total, 18);
            setTotalVaultHbar(totalFormatted);
            addLog(`Vault Total: ${totalFormatted} HBAR`);

        } catch (err) {
            addLog(`State Error: ${err.message}`, 'error');
        }
    }, [userAddress]);

    useEffect(() => {
        if (userAddress) {
            fetchVaultBalance();
        }
    }, [userAddress, fetchVaultBalance]);

    const syncWithRetry = useCallback(async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
            await fetchVaultBalance();
            await refreshWalletBalance();
            if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
        }
    }, [fetchVaultBalance, refreshWalletBalance]);

    const handleAction = async (action) => {
        if (!walletConnected || !address || !walletProvider) {
            addLog("Connect wallet to start", "error");
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            addLog("Invalid amount", "error");
            return;
        }

        setLoading(true);
        addLog(`Initiating ${action} for ${amount} HBAR...`);
        
        window.dispatchEvent(new CustomEvent('showTxOverlay', { 
            detail: { title: `Vault ${action === 'deposit' ? 'Deposit' : 'Withdrawal'}`, desc: 'Please confirm in your wallet...' } 
        }));

        try {
            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI, signer);

            let tx;
            let finalGasLimit = 250000; 

            if (action === 'deposit') {
                const valWei = ethers.parseUnits(amount, 18);
                
                try {
                    const estimated = await contract.deposit.estimateGas({ value: valWei });
                    finalGasLimit = (estimated * 120n) / 100n;
                } catch (e) { addLog("Gas Est Failed (Deposit)", "warn"); }

                addLog(`Sending ${amount} HBAR (${valWei.toString()} wei)...`);
                tx = await contract.deposit({ value: valWei, gasLimit: finalGasLimit });
            } else {
                const valTiny = ethers.parseUnits(amount, 8);
                
                try {
                    const estimated = await contract.withdraw.estimateGas(valTiny);
                    finalGasLimit = (estimated * 120n) / 100n;
                } catch (e) { addLog("Gas Est Failed (Withdraw)", "warn"); }

                addLog(`Withdrawing ${amount} HBAR (${valTiny.toString()} tinybars)...`);
                tx = await contract.withdraw(valTiny, { gasLimit: finalGasLimit });
            }

            addLog(`Sent! Hash: ${tx.hash.slice(0, 10)}...`);
            await tx.wait();
            addLog(`${action} Confirmed!`);

            if (action === 'deposit') {
                const starsEarned = Math.floor(parseFloat(amount) * 10);
                updateStarPoints(starsEarned);
                window.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: `Deposited ${amount} HBAR! +${starsEarned} Stars!`, type: 'success' } 
                }));
            } else {
                window.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: `Withdrawn ${amount} HBAR!`, type: 'success' } 
                }));
            }

            syncWithRetry();
        } catch (err) {
            addLog(`Error: ${err.message.slice(0, 50)}...`, 'error');
            window.dispatchEvent(new CustomEvent('showToast', { detail: { message: err.message, type: 'error' } }));
        } finally {
            setLoading(false);
            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
        }
    };

    return (
        <div className="view section-active">
            <button className="btn btn-glow" onClick={() => navigate('/')} style={{ marginBottom: '2rem' }}>&larr; Back to Hub</button>
            
            <div className="hero-section">
                <div className="hero-header">
                    <h2 className="neon-text outline-text text-center" style={{ width: '100%' }}>STAKING VAULT</h2>
                    <p className="hero-subtitle">Your secure on-chain bankroll for PlayFi games.</p>
                </div>

                <div className="glass-panel" style={{ 
                    padding: '3rem', 
                    textAlign: 'center', 
                    marginBottom: '2rem',
                    background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.1) 0%, rgba(0,0,0,0) 70%)',
                    border: '1px solid rgba(0, 240, 255, 0.3)'
                }}>
                    <label style={{ fontSize: '1.2rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px' }}>Your Staked Balance</label>
                    <div className="stat-value text-gradient" style={{ fontSize: '5rem', fontWeight: '900', margin: '1rem 0' }}>
                        {parseFloat(vaultBalance).toFixed(2)} <span style={{ fontSize: '2rem' }}>HBAR</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', color: 'var(--primary-color)', fontSize: '0.9rem' }}>
                        <span>Status: <span style={{ color: '#00ff88' }}>● Live</span></span>
                        <span>Total Vault Assets: <span style={{ color: 'white' }}>{parseFloat(totalVaultHbar).toFixed(2)} HBAR</span></span>
                        <span onClick={() => syncWithRetry(1)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>↻ Force Refresh</span>
                    </div>
                </div>

                {/* STREAK REWARD SECTION */}
                <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px dashed rgba(0, 240, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h4 style={{ color: '#00f0ff', marginBottom: '0.2rem' }}>⭐ Staking Streak</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Earn 10 stars every 24 hours while you have HBAR staked.</p>
                    </div>
                    
                    {parseFloat(vaultBalance) <= 0 ? (
                        <div style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            Deposit HBAR to start your 10-Star Daily Streak!
                        </div>
                    ) : (
                        <div style={{ textAlign: 'right' }}>
                            {timeRemaining > 0 ? (
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>
                                    Next Reward: <span style={{ color: '#00f0ff' }}>{formatCountdown(timeRemaining)}</span>
                                </div>
                            ) : (
                                <button className="btn btn-glow" onClick={handleClaimStreak} style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}>
                                    CLAIM 10 STARS
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="crash-container" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', color: '#00f0ff' }}>Deposit or Withdraw</h3>
                        <div className="bet-input-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Amount to Stake / Withdraw</span>
                                <span 
                                    onClick={() => setAmount(vaultBalance)} 
                                    style={{ color: '#00f0ff', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                                >
                                    USE MAX
                                </span>
                            </label>
                            <div className="input-wrapper" style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px' }}>
                                <input 
                                    type="number" 
                                    value={amount} 
                                    onChange={(e) => setAmount(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', width: '100%' }}
                                    placeholder="0.00"
                                />
                                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>HBAR</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button 
                                className="btn btn-primary btn-glow" 
                                style={{ flex: 1, padding: '1.2rem' }} 
                                onClick={() => handleAction('deposit')}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'DEPOSIT'}
                            </button>
                            <button 
                                className="btn btn-hero" 
                                style={{ flex: 1, marginTop: 0, padding: '1.2rem' }} 
                                onClick={() => handleAction('withdraw')}
                                disabled={loading}
                            >
                                {loading ? 'Processing...' : 'WITHDRAW'}
                            </button>
                        </div>
                    </div>

                    {/* ACTIVITY LOG */}
                    <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)' }}>
                        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>VAULT ACTIVITY</h4>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
                            {debugLog.length === 0 && <div style={{ color: '#444' }}>No recent activity...</div>}
                            {debugLog.map((log, i) => (
                                <div key={i} style={{ 
                                    padding: '8px 0', 
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    color: log.includes('Error') ? '#ff4444' : log.includes('Balance Found') ? '#00ff88' : '#aaa'
                                }}>
                                    {log}
                                </div>
                            ))}
                        </div>
                        <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#555', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Connected: {userAddress?.slice(0, 10)}...</span>
                            <span>v1.0.7 - Staking Streak</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Vault;
