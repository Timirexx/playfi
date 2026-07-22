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
            <style>{`
                /* =============================================
                   VAULT — PREMIUM REDESIGN
                ============================================= */
                .vt-page {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1rem 3rem;
                }

                /* Header */
                .vt-header {
                    display: flex;
                    align-items: center;
                    position: relative;
                    padding: 1.5rem 0 2.5rem;
                }
                .vt-back-btn {
                    position: absolute;
                    left: 0;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1.2rem;
                    border-radius: 100px;
                    border: 1px solid rgba(255,255,255,0.12);
                    background: rgba(255,255,255,0.04);
                    color: var(--text-main);
                    font-family: var(--font-heading);
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    backdrop-filter: blur(8px);
                    text-decoration: none;
                    white-space: nowrap;
                }
                .vt-back-btn:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.25);
                    transform: translateX(-2px);
                }
                .vt-title-wrap {
                    text-align: center;
                    flex: 1;
                }
                .vt-title {
                    font-family: var(--font-heading);
                    font-size: clamp(2rem, 5vw, 3.5rem);
                    font-weight: 900;
                    letter-spacing: 4px;
                    margin: 0;
                    background: linear-gradient(90deg, #00f0ff, #fff 50%, #00f0ff);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: vt-shimmer 4s linear infinite;
                    text-transform: uppercase;
                }
                @keyframes vt-shimmer {
                    0%   { background-position: 0% center; }
                    100% { background-position: 200% center; }
                }
                .vt-subtitle {
                    color: var(--text-muted);
                    font-size: 0.95rem;
                    margin-top: 0.5rem;
                }

                /* Layout */
                .vt-layout {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 2rem;
                }

                /* Main Glass Cards */
                .vt-card {
                    background: rgba(5, 7, 12, 0.85);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 240, 255, 0.2);
                    border-radius: 20px;
                    padding: 2.5rem;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .vt-card-title {
                    color: #00f0ff;
                    font-size: 1.2rem;
                    font-family: var(--font-heading);
                    margin: 0 0 1.5rem 0;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                /* Balance Display */
                .vt-balance-wrap {
                    text-align: center;
                    margin: 1rem 0 2rem;
                    position: relative;
                }
                .vt-balance-glow {
                    position: absolute;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    width: 150px; height: 150px;
                    background: var(--neon-blue);
                    filter: blur(80px);
                    opacity: 0.15;
                    pointer-events: none;
                }
                .vt-balance-label {
                    font-size: 1rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 0.5rem;
                }
                .vt-balance-amount {
                    font-size: clamp(3rem, 6vw, 5rem);
                    font-weight: 900;
                    font-family: var(--font-heading);
                    background: linear-gradient(90deg, #ffb800, #ffe066, #ffb800);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: vt-shimmer 3s linear infinite;
                    line-height: 1.1;
                }
                .vt-balance-currency {
                    font-size: clamp(1.5rem, 3vw, 2.5rem);
                    color: var(--text-muted);
                    margin-left: 0.5rem;
                    font-weight: 700;
                    -webkit-text-fill-color: var(--text-muted);
                }

                /* Staking Controls */
                .vt-controls-wrapper {
                    background: rgba(0,0,0,0.3);
                    border-radius: 16px;
                    padding: 1.5rem;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .vt-input-group {
                    position: relative;
                    margin-bottom: 1.5rem;
                }
                .vt-input-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.8rem;
                    font-size: 0.9rem;
                    color: var(--text-muted);
                }
                .vt-use-max {
                    color: #00f0ff;
                    cursor: pointer;
                    font-weight: 700;
                    text-decoration: underline;
                    transition: color 0.3s;
                }
                .vt-use-max:hover {
                    color: #fff;
                    text-shadow: 0 0 10px #00f0ff;
                }
                .vt-input {
                    width: 100%;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(0, 240, 255, 0.2);
                    border-radius: 12px;
                    padding: 1.2rem 4rem 1.2rem 1.5rem;
                    color: white;
                    font-size: 1.5rem;
                    font-family: var(--font-heading);
                    outline: none;
                    transition: all 0.3s ease;
                }
                .vt-input:focus {
                    border-color: #00f0ff;
                    box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
                    background: rgba(255,255,255,0.08);
                }
                .vt-input-currency {
                    position: absolute;
                    right: 1.5rem;
                    bottom: 1.3rem;
                    color: #00f0ff;
                    font-weight: 800;
                    font-size: 1.2rem;
                }
                .vt-btn-row {
                    display: flex;
                    gap: 1rem;
                }
                .vt-action-btn {
                    flex: 1;
                    padding: 1.2rem;
                    border-radius: 12px;
                    border: none;
                    font-family: var(--font-heading);
                    font-weight: 800;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .vt-btn-deposit {
                    background: linear-gradient(90deg, #00f0ff, #0080ff);
                    color: #000;
                    box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
                }
                .vt-btn-deposit:hover:not(:disabled) {
                    box-shadow: 0 0 30px rgba(0, 240, 255, 0.7);
                    transform: translateY(-2px);
                    color: #fff;
                }
                .vt-btn-withdraw {
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .vt-btn-withdraw:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.3);
                    transform: translateY(-2px);
                }
                .vt-action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                /* Streak Card */
                .vt-streak-card {
                    background: rgba(255, 184, 0, 0.05);
                    border: 1px dashed rgba(255, 184, 0, 0.3);
                    border-radius: 16px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 1.5rem;
                    transition: all 0.3s ease;
                }
                .vt-streak-card:hover {
                    background: rgba(255, 184, 0, 0.08);
                    border-color: rgba(255, 184, 0, 0.5);
                }
                .vt-streak-info h4 {
                    color: #ffb800;
                    margin: 0 0 0.2rem 0;
                    font-size: 1.1rem;
                }
                .vt-streak-info p {
                    color: var(--text-muted);
                    margin: 0;
                    font-size: 0.85rem;
                }
                .vt-streak-action {
                    text-align: right;
                }
                .vt-streak-timer {
                    font-size: 1.3rem;
                    font-weight: 800;
                    color: #ffb800;
                    font-family: var(--font-heading);
                }
                .vt-streak-btn {
                    background: linear-gradient(90deg, #ffb800, #ff8a00);
                    color: #000;
                    border: none;
                    padding: 0.8rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 800;
                    cursor: pointer;
                    box-shadow: 0 0 15px rgba(255, 184, 0, 0.4);
                    transition: all 0.3s ease;
                }
                .vt-streak-btn:hover {
                    box-shadow: 0 0 25px rgba(255, 184, 0, 0.7);
                    transform: translateY(-2px) scale(1.02);
                }

                /* Right Column Stats */
                .vt-stats-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                .vt-stat-item {
                    background: rgba(0,0,0,0.2);
                    padding: 1.5rem;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .vt-stat-label {
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    margin-bottom: 0.5rem;
                }
                .vt-stat-val {
                    color: #fff;
                    font-size: 1.8rem;
                    font-weight: 800;
                    font-family: var(--font-heading);
                }
                .vt-stat-val span {
                    font-size: 1rem;
                    color: #00f0ff;
                }
                
                /* Activity Log */
                .vt-activity-log {
                    flex: 1;
                    background: rgba(0,0,0,0.4);
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                }
                .vt-log-header {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    margin-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    padding-bottom: 0.5rem;
                    display: flex;
                    justify-content: space-between;
                }
                .vt-log-content {
                    flex: 1;
                    max-height: 250px;
                    overflow-y: auto;
                    font-family: monospace;
                    font-size: 0.8rem;
                }
                .vt-log-row {
                    padding: 0.4rem 0;
                    border-bottom: 1px dashed rgba(255,255,255,0.05);
                }
                
                @media (max-width: 900px) {
                    .vt-layout { grid-template-columns: 1fr; }
                    .vt-btn-row { flex-direction: column; }
                    .vt-streak-card { flex-direction: column; text-align: center; gap: 1rem; }
                    .vt-streak-action { text-align: center; }
                    .vt-header { flex-direction: column; gap: 1.5rem; padding-top: 1rem; }
                    .vt-back-btn { position: relative; left: auto; }
                }
            `}</style>
            
            <div className="vt-page">
                <div className="vt-header">
                    <button className="vt-back-btn" onClick={() => navigate('/')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        Back to Hub
                    </button>
                    <div className="vt-title-wrap">
                        <h2 className="vt-title">STAKING VAULT</h2>
                        <p className="vt-subtitle">Your secure on-chain bankroll for PlayFi games.</p>
                    </div>
                </div>

                <div className="vt-layout">
                    {/* Left Column: Balance & Controls */}
                    <div className="vt-left">
                        <div className="vt-card">
                            <h3 className="vt-card-title">
                                <span>Vault Assets</span>
                                <div style={{ fontSize: '0.85rem', color: '#00ff88', textTransform: 'none', letterSpacing: 'normal', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ width: '8px', height: '8px', background: '#00ff88', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #00ff88' }}></span>
                                    Network Live
                                </div>
                            </h3>
                            
                            <div className="vt-balance-wrap">
                                <div className="vt-balance-glow"></div>
                                <div className="vt-balance-label">Your Staked Balance</div>
                                <div className="vt-balance-amount">
                                    {parseFloat(vaultBalance).toFixed(2)}
                                    <span className="vt-balance-currency">HBAR</span>
                                </div>
                            </div>

                            <div className="vt-controls-wrapper">
                                <div className="vt-input-group">
                                    <div className="vt-input-header">
                                        <span>Amount to Stake / Withdraw</span>
                                        <span className="vt-use-max" onClick={() => setAmount(vaultBalance)}>USE MAX</span>
                                    </div>
                                    <input 
                                        type="number" 
                                        className="vt-input"
                                        value={amount} 
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                    <span className="vt-input-currency">HBAR</span>
                                </div>
                                <div className="vt-btn-row">
                                    <button 
                                        className="vt-action-btn vt-btn-deposit" 
                                        onClick={() => handleAction('deposit')}
                                        disabled={loading}
                                    >
                                        {loading ? 'Processing...' : 'Deposit HBAR'}
                                    </button>
                                    <button 
                                        className="vt-action-btn vt-btn-withdraw" 
                                        onClick={() => handleAction('withdraw')}
                                        disabled={loading}
                                    >
                                        {loading ? 'Processing...' : 'Withdraw'}
                                    </button>
                                </div>
                            </div>

                            {/* Streak Reward Section */}
                            <div className="vt-streak-card">
                                <div className="vt-streak-info">
                                    <h4>⭐ Staking Streak</h4>
                                    <p>Earn 10 stars every 24 hours while staked.</p>
                                </div>
                                <div className="vt-streak-action">
                                    {parseFloat(vaultBalance) <= 0 ? (
                                        <div style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            Deposit to start!
                                        </div>
                                    ) : (
                                        timeRemaining > 0 ? (
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NEXT REWARD IN</div>
                                                <div className="vt-streak-timer">{formatCountdown(timeRemaining)}</div>
                                            </div>
                                        ) : (
                                            <button className="vt-streak-btn" onClick={handleClaimStreak}>
                                                CLAIM 10 STARS
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Stats & Log */}
                    <div className="vt-right">
                        <div className="vt-card" style={{ height: '100%' }}>
                            <h3 className="vt-card-title">
                                <span>Network Status</span>
                                <span onClick={() => syncWithRetry(1)} style={{ cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }} title="Force Refresh">↻</span>
                            </h3>

                            <div className="vt-stats-list">
                                <div className="vt-stat-item">
                                    <div className="vt-stat-label">Total Vault Assets</div>
                                    <div className="vt-stat-val">
                                        {parseFloat(totalVaultHbar).toFixed(2)} <span>HBAR</span>
                                    </div>
                                </div>
                                <div className="vt-stat-item">
                                    <div className="vt-stat-label">Current APY</div>
                                    <div className="vt-stat-val" style={{ color: '#00f0ff' }}>
                                        12.5% <span>(Est.)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="vt-activity-log">
                                <div className="vt-log-header">
                                    <span>Live Activity</span>
                                    <span>{userAddress ? userAddress.slice(0,6) + '...' + userAddress.slice(-4) : 'Disconnected'}</span>
                                </div>
                                <div className="vt-log-content">
                                    {debugLog.length === 0 && <div style={{ color: '#555', fontStyle: 'italic', padding: '0.5rem 0' }}>Waiting for activity...</div>}
                                    {debugLog.map((log, i) => (
                                        <div key={i} className="vt-log-row" style={{ 
                                            color: log.includes('Error') ? '#ff4444' : log.includes('Balance Found') ? '#00ff88' : '#aaa'
                                        }}>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Vault;
