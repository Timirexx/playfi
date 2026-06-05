import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import axios from 'axios';
import { ethers } from 'ethers';
import { useAppKitProvider } from '@reown/appkit/react';
import { PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI } from '../contracts/PlayFiVault';

// --- MATH UTILS FOR 16-BOX PREVIEW ---
const factorial = (n) => {
    if (n === 0 || n === 1) return 1n;
    let res = 1n;
    for (let i = 2n; i <= BigInt(n); i++) res *= i;
    return res;
};

const nCr = (n, r) => {
    if (r < 0 || r > n) return 0n;
    return factorial(n) / (factorial(r) * factorial(n - r));
};

const calculateMultiplier = (mines, revealed) => {
    if (revealed === 0) return 1.0;
    const houseEdge = 0.99;
    const combinationsTotal = nCr(30, revealed);
    const combinationsSafe = nCr(30 - mines, revealed);
    return houseEdge * (Number(combinationsTotal) / Number(combinationsSafe));
};

const Mines = () => {
    const navigate = useNavigate();
    const { isConnected, address, updateStarPoints } = useWallet();
    const { walletProvider } = useAppKitProvider('eip155');
    
    // API Config
    const API_BASE = window.location.hostname === 'localhost' ? "http://localhost:3001" : "https://playfi-backend.vercel.app";

    // Game State
    const [gameState, setGameState] = useState('idle'); // idle, playing, ended, won
    const [betAmount, setBetAmount] = useState("1");
    const [minesCount, setMinesCount] = useState(3);
    const [grid, setGrid] = useState(() => Array.from({ length: 30 }, () => ({ status: 'covered' })));
    const [revealedCount, setRevealedCount] = useState(0);
    const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
    const [loading, setLoading] = useState(false);
    
    // Provably Fair
    const [clientSeed] = useState(() => Math.random().toString(36).substring(2, 12));
    const [serverSeedHash, setServerSeedHash] = useState("");

    const startGame = async () => {
        if (!isConnected || !address || !walletProvider) {
            window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Connect wallet to play!', type: 'error' } }));
            return;
        }

        setLoading(true);
        window.dispatchEvent(new CustomEvent('showTxOverlay', { 
            detail: { title: 'Star Hunt Buy-In', desc: 'Confirming your wager on-chain...' } 
        }));

        try {
            // 1. Check Balance and Trigger Buy-In Deposit to Vault if needed
            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const vaultContract = new ethers.Contract(PLAYFI_VAULT_ADDRESS, PLAYFI_VAULT_ABI, signer);

            const valWei = ethers.parseUnits(betAmount, 18);
            const userBal = await vaultContract.userBalances(address);
            
            if (userBal < valWei) {
                const diff = valWei - userBal;
                window.dispatchEvent(new CustomEvent('showTxOverlay', { 
                    detail: { title: 'Vault Deposit Required', desc: `Depositing ${ethers.formatUnits(diff, 18)} HBAR to your vault to cover the bet...` } 
                }));
                const tx = await vaultContract.deposit({ value: diff });
                await tx.wait();
            }

            // 2. Notify Backend to Start Game
            const res = await axios.post(`${API_BASE}/api/mines/start`, {
                userAddress: address,
                betAmount,
                minesCount,
                clientSeed
            });

            if (res.data.success) {
                setGrid(Array.from({ length: 30 }, () => ({ status: 'covered' })));
                setRevealedCount(0);
                setCurrentMultiplier(1.0);
                setServerSeedHash(res.data.serverSeedHash);
                setGameState('playing');
                updateStarPoints(10); // Star Bonus!
                window.dispatchEvent(new CustomEvent('showToast', { 
                    detail: { message: `Wager Confirmed! Good Luck ⭐`, type: 'success' } 
                }));
            }
        } catch (err) {
            console.error("Start Error:", err);
            window.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: err.reason || err.message || 'Transaction failed', type: 'error' } 
            }));
        } finally {
            setLoading(false);
            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
        }
    };

    const handleCellClick = async (index) => {
        if (gameState !== 'playing' || grid[index].status !== 'covered' || loading) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/api/mines/reveal`, {
                userAddress: address,
                tileIndex: index
            });

            if (res.data.success) {
                const newGrid = [...grid];
                if (res.data.status === 'bomb') {
                    res.data.grid.forEach((isMine, i) => {
                        newGrid[i] = { status: isMine ? 'mine' : 'revealed_empty' };
                    });
                    setGameState('ended');
                    window.dispatchEvent(new CustomEvent('showToast', { detail: { message: '💣 BOMB! You lost.', type: 'error' } }));
                } else {
                    newGrid[index] = { status: 'star' };
                    setRevealedCount(prev => prev + 1);
                    setCurrentMultiplier(res.data.multiplier);
                    
                    if (res.data.status === 'victory') {
                        setGameState('won');
                        res.data.grid.forEach((isMine, i) => {
                            if (isMine) newGrid[i] = { status: 'mine' };
                        });
                        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: `PERFECT SCORE!`, type: 'success' } }));
                    }
                }
                setGrid(newGrid);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCashout = async () => {
        if (gameState !== 'playing' || revealedCount === 0 || loading) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/api/mines/cashout`, {
                userAddress: address
            });

            if (res.data.success) {
                setGameState('won');
                const newGrid = [...grid];
                res.data.grid.forEach((isMine, i) => {
                    if (isMine) newGrid[i] = { status: isMine ? 'mine' : 'revealed_empty' };
                });
                setGrid(newGrid);
                window.dispatchEvent(new CustomEvent('showToast', { detail: { message: `Reward Claimed: ${res.data.winAmount.toFixed(2)} HBAR!`, type: 'success' } }));
            }
        } catch (err) {
            window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Claim failed', type: 'error' } }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="view section-active">
            <style>{`
                .star-hunt-layout { display: grid; grid-template-columns: 320px 1fr 280px; gap: 2rem; align-items: start; max-width: 1400px; margin: 0 auto; }
                
                .star-grid { 
                    display: grid !important; 
                    grid-template-columns: repeat(6, 1fr) !important; 
                    gap: 10px; 
                    padding: 1rem; 
                    width: 100%; 
                    max-width: 500px; 
                    margin: 0 auto;
                }
                
                .star-box {
                    aspect-ratio: 1 / 1; 
                    background: rgba(255, 255, 255, 0.07); 
                    border: 1px solid rgba(0, 240, 255, 0.3);
                    border-radius: 12px; 
                    cursor: pointer; 
                    transition: all 0.2s ease;
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 2rem;
                    min-height: 60px;
                }
                .star-box:hover:not(.revealed) { background: rgba(0, 240, 255, 0.1); border-color: var(--neon-blue); transform: scale(1.05); }
                .star-box.star { background: rgba(0, 240, 255, 0.15); border-color: var(--neon-blue); box-shadow: 0 0 20px var(--neon-blue-glow); cursor: default; }
                .star-box.mine { background: rgba(255, 51, 102, 0.2); border-color: var(--danger); }
                .star-box.revealed_empty { opacity: 0.2; cursor: default; }

                .mult-sidebar { max-height: 450px; overflow-y: auto; padding-right: 5px; }
                .star-mult { 
                    padding: 0.7rem; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); 
                    border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;
                    font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem;
                }
                .star-mult.active { background: var(--neon-blue); color: #000; box-shadow: 0 0 15px var(--neon-blue-glow); }
                .star-mult.next { border-color: var(--neon-blue); border-style: dashed; opacity: 0.8; }
            `}</style>

            <div className="hero-section">
                <div className="hero-header">
                    <button className="btn" onClick={() => navigate('/')}>&larr; HUB</button>
                    <h2 className="neon-text outline-text">STAR HUNT</h2>
                    <div className="live-status">30 BOXES</div>
                </div>

                <div className="star-hunt-layout">
                    {/* CONTROLS */}
                    <div className="crash-controls glass-panel">
                        <div className="bet-input-group">
                            <label>STAKE HBAR</label>
                            <div className="input-wrapper">
                                <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)} disabled={gameState === 'playing'} />
                                <span className="input-currency">HBAR</span>
                            </div>
                        </div>

                        <div className="bet-input-group">
                            <label>BOMBS COUNT</label>
                            <div className="input-wrapper">
                                <input type="number" value={minesCount} onChange={e => setMinesCount(Math.min(29, parseInt(e.target.value) || 1))} disabled={gameState === 'playing'} />
                                <span className="input-currency">💣</span>
                            </div>
                        </div>

                        {gameState === 'playing' ? (
                            <button className="btn btn-hero btn-glow" onClick={handleCashout} disabled={loading || revealedCount === 0} style={{ background: 'var(--success)', color: '#000' }}>
                                {loading ? 'WAIT...' : `STOP & CLAIM (${(parseFloat(betAmount) * currentMultiplier).toFixed(2)})`}
                            </button>
                        ) : (
                            <button className="btn btn-hero btn-glow" onClick={startGame} disabled={loading}>
                                {loading ? 'OPENING BOARD...' : 'START HUNT'}
                            </button>
                        )}

                        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', fontSize: '0.7rem' }}>
                            <p className="text-muted">SERVER HASH</p>
                            <p style={{ wordBreak: 'break-all', color: 'var(--neon-blue)' }}>{serverSeedHash || '0x0000...0000'}</p>
                        </div>
                    </div>

                    {/* GRID */}
                    <div className="game-area">
                        <div className="glass-panel" style={{ padding: '2rem' }}>
                            <p className="text-center" style={{ marginBottom: '1.5rem', fontWeight: 700, letterSpacing: '2px' }}>FIND THE ⭐ STARS</p>
                            <div className="star-grid">
                                {Array.from({ length: 30 }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`star-box ${grid[i]?.status || 'covered'}`}
                                        onClick={() => handleCellClick(i)}
                                    >
                                        {grid[i]?.status === 'star' ? '⭐' : grid[i]?.status === 'mine' ? '💣' : ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* MULTIPLIERS */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--neon-blue)', fontSize: '0.9rem' }}>GROWTH CURVE</h4>
                        <div className="mult-sidebar">
                            {Array(8).fill(null).map((_, i) => {
                                const step = revealedCount + (4 - i);
                                if (step <= 0 || step > (30 - minesCount)) return null;
                                const m = calculateMultiplier(minesCount, step);
                                return (
                                    <div key={i} className={`star-mult ${step === revealedCount ? 'active' : step === revealedCount + 1 ? 'next' : ''}`}>
                                        <span>{step} ⭐</span>
                                        <span>{m.toFixed(2)}x</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <h2 className="neon-text" style={{ fontSize: '2.5rem' }}>{currentMultiplier.toFixed(2)}x</h2>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CURRENT REWARD</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Mines;
