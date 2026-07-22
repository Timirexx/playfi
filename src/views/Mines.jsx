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
    const { isConnected, address, updateStarPoints, refreshBalance } = useWallet();
    const { walletProvider } = useAppKitProvider('eip155');
    
    // API Config
    const API_BASE = window.location.hostname === 'localhost' ? "http://localhost:3001" : "https://server-chi-rose-76.vercel.app";

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
            const tx = await vaultContract.placeBet({ value: valWei });
            await tx.wait();

            // 2. Notify Backend to Start Game
            const res = await axios.post(`${API_BASE}/api/mines/start`, {
                transactionId: tx.hash,
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
                    detail: { message: `Wager Confirmed! Good Luck 🎁`, type: 'success' } 
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
                        if (i === index) {
                            newGrid[i] = { status: 'mine_clicked' };
                        } else {
                            newGrid[i] = { status: isMine ? 'mine_revealed' : 'star_revealed' };
                        }
                    });
                    setGameState('ended');
                    window.dispatchEvent(new CustomEvent('showToast', { detail: { message: '💣 BOMB! You lost.', type: 'error' } }));
                    
                    // Auto-reset after 3 seconds
                    setTimeout(() => {
                        setGrid(Array.from({ length: 30 }, () => ({ status: 'covered' })));
                        setRevealedCount(0);
                        setCurrentMultiplier(1.0);
                        setGameState('idle');
                        setServerSeedHash('');
                    }, 3000);
                } else {
                    newGrid[index] = { status: 'star' };
                    setRevealedCount(prev => prev + 1);
                    setCurrentMultiplier(res.data.multiplier);
                    
                    if (res.data.status === 'victory') {
                        setGameState('won');
                        res.data.grid.forEach((isMine, i) => {
                            if (isMine) newGrid[i] = { status: 'mine_revealed' };
                        });
                        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: `PERFECT SCORE!`, type: 'success' } }));
                        
                        // Auto-reset after 3 seconds
                        setTimeout(() => {
                            setGrid(Array.from({ length: 30 }, () => ({ status: 'covered' })));
                            setRevealedCount(0);
                            setCurrentMultiplier(1.0);
                            setGameState('idle');
                            setServerSeedHash('');
                            refreshBalance();
                        }, 3000);
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
                    if (isMine) newGrid[i] = { status: 'mine_revealed' };
                    else if (newGrid[i].status !== 'star') newGrid[i] = { status: 'star_revealed' };
                });
                setGrid(newGrid);
                window.dispatchEvent(new CustomEvent('showToast', { detail: { message: `LOOT SECURED: ${res.data.winAmount.toFixed(2)} HBAR!`, type: 'success' } }));
                
                // Auto-reset after 3 seconds
                setTimeout(() => {
                    setGrid(Array.from({ length: 30 }, () => ({ status: 'covered' })));
                    setRevealedCount(0);
                    setCurrentMultiplier(1.0);
                    setGameState('idle');
                    setServerSeedHash('');
                    refreshBalance();
                }, 3000);
            }
        } catch (err) {
            window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Cash Out failed', type: 'error' } }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="view section-active">
            <style>{`
                /* =============================================
                   STAR HUNT — PREMIUM REDESIGN
                ============================================= */

                /* Page wrapper */
                .sh-page {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 1rem 3rem;
                }

                /* ---- Header ---- */
                .sh-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem 0 2rem;
                    gap: 1rem;
                }

                .sh-back-btn {
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
                .sh-back-btn:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.25);
                    transform: translateX(-2px);
                }

                .sh-title-wrap {
                    text-align: center;
                    flex: 1;
                }
                .sh-title {
                    font-family: var(--font-heading);
                    font-size: clamp(2rem, 5vw, 3.5rem);
                    font-weight: 900;
                    letter-spacing: 4px;
                    background: linear-gradient(90deg, #00f0ff, #fff 50%, #00f0ff);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: sh-shimmer 4s linear infinite;
                    text-transform: uppercase;
                }
                @keyframes sh-shimmer {
                    0%   { background-position: 0% center; }
                    100% { background-position: 200% center; }
                }
                .sh-subtitle {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    margin-top: 0.3rem;
                }

                .sh-boxes-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1.2rem;
                    border-radius: 100px;
                    border: 1px solid rgba(255, 51, 102, 0.5);
                    background: rgba(255, 51, 102, 0.1);
                    color: #ff3366;
                    font-family: var(--font-heading);
                    font-size: 0.85rem;
                    font-weight: 700;
                    white-space: nowrap;
                }

                /* ---- 3-Column Layout ---- */
                .sh-layout {
                    display: grid;
                    grid-template-columns: 300px 1fr 280px;
                    gap: 1.5rem;
                    align-items: start;
                }

                /* ---- Shared panel ---- */
                .sh-panel {
                    background: rgba(10, 12, 20, 0.8);
                    border: 1px solid rgba(0, 240, 255, 0.12);
                    border-radius: 20px;
                    backdrop-filter: blur(16px);
                    padding: 1.8rem;
                    transition: border-color 0.3s ease;
                }
                .sh-panel:hover {
                    border-color: rgba(0, 240, 255, 0.22);
                }

                /* ---- Left: Settings ---- */
                .sh-settings-title {
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: var(--neon-blue);
                    text-transform: uppercase;
                    margin-bottom: 1.4rem;
                }
                .sh-field {
                    margin-bottom: 1.2rem;
                }
                .sh-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    margin-bottom: 0.5rem;
                    display: block;
                }
                .sh-input-row {
                    display: flex;
                    align-items: center;
                    background: rgba(0,0,0,0.5);
                    border: 1px solid rgba(0,240,255,0.15);
                    border-radius: 10px;
                    overflow: hidden;
                    transition: border-color 0.3s ease, box-shadow 0.3s ease;
                }
                .sh-input-row:focus-within {
                    border-color: rgba(0,240,255,0.5);
                    box-shadow: 0 0 0 3px rgba(0,240,255,0.08);
                }
                .sh-input-row input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    padding: 0.85rem 1rem;
                    color: var(--text-main);
                    font-family: var(--font-heading);
                    font-size: 1.1rem;
                    font-weight: 700;
                }
                .sh-input-row input:disabled {
                    opacity: 0.5;
                }
                .sh-input-suffix {
                    padding: 0 1rem;
                    color: var(--text-muted);
                    font-family: var(--font-heading);
                    font-size: 0.85rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                /* Risk bar */
                .sh-risk-bar {
                    display: flex;
                    gap: 3px;
                    margin-top: 0.6rem;
                }
                .sh-risk-segment {
                    flex: 1;
                    height: 5px;
                    border-radius: 3px;
                    transition: opacity 0.3s;
                }
                .sh-risk-labels {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.65rem;
                    color: var(--text-muted);
                    margin-top: 0.3rem;
                }
                .sh-risk-labels .high { color: #ff3366; }

                /* Start / Cashout buttons */
                .sh-start-btn {
                    width: 100%;
                    padding: 1rem;
                    border-radius: 12px;
                    border: none;
                    cursor: pointer;
                    font-family: var(--font-heading);
                    font-size: 1.1rem;
                    font-weight: 900;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    margin-top: 1.2rem;
                    position: relative;
                    overflow: hidden;
                }
                .sh-start-btn.start {
                    background: var(--neon-blue);
                    color: #000;
                    box-shadow: 0 0 20px rgba(0,240,255,0.4);
                }
                .sh-start-btn.start:hover:not(:disabled) {
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 0 35px rgba(0,240,255,0.7);
                }
                .sh-start-btn.cashout {
                    background: var(--success);
                    color: #000;
                    box-shadow: 0 0 20px rgba(0,230,118,0.4);
                    animation: sh-cashout-pulse 1.5s ease-in-out infinite;
                }
                @keyframes sh-cashout-pulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(0,230,118,0.4); }
                    50%       { box-shadow: 0 0 35px rgba(0,230,118,0.7); }
                }
                .sh-start-btn.cashout:hover:not(:disabled) {
                    transform: translateY(-3px) scale(1.02);
                }
                .sh-start-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none !important;
                }
                /* Shimmer sweep */
                .sh-start-btn::before {
                    content: '';
                    position: absolute;
                    top: 0; left: -100%;
                    width: 60%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                    transform: skewX(-20deg);
                    transition: left 0s;
                }
                .sh-start-btn:hover:not(:disabled)::before {
                    left: 160%;
                    transition: left 0.5s ease;
                }

                /* Provably fair badge */
                .sh-fair-box {
                    margin-top: 1.5rem;
                    padding: 0.9rem 1rem;
                    background: rgba(0,0,0,0.35);
                    border: 1px solid rgba(0,240,255,0.1);
                    border-radius: 12px;
                }
                .sh-fair-hash {
                    font-size: 0.65rem;
                    color: var(--neon-blue);
                    word-break: break-all;
                    font-family: monospace;
                    margin-top: 0.3rem;
                }
                .sh-fair-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }
                .sh-fair-verified {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    margin-top: 0.6rem;
                }

                /* ---- Centre: Grid ---- */
                .sh-grid-panel-title {
                    text-align: center;
                    font-family: var(--font-heading);
                    font-size: 1rem;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: var(--text-main);
                    margin-bottom: 0.3rem;
                }
                .sh-grid-panel-sub {
                    text-align: center;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    margin-bottom: 1.5rem;
                }
                .sh-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 8px;
                    width: 100%;
                    max-width: 520px;
                    margin: 0 auto;
                }
                .sh-cell {
                    aspect-ratio: 1 / 1;
                    border-radius: 10px;
                    border: 1px solid rgba(0, 240, 255, 0.18);
                    background: rgba(8, 12, 22, 0.9);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
                }
                /* Star icon inside uncovered tile */
                .sh-cell-icon {
                    font-size: 1.3rem;
                    opacity: 0.25;
                    transition: opacity 0.3s ease, transform 0.3s ease;
                    pointer-events: none;
                }
                /* Shimmer layer */
                .sh-cell::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, rgba(0,240,255,0.14) 0%, transparent 70%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    border-radius: inherit;
                }
                /* Hover */
                .sh-cell:hover:not(.sh-cell-revealed) {
                    border-color: rgba(0,240,255,0.6);
                    background: rgba(0,240,255,0.08);
                    transform: translateY(-3px) scale(1.04);
                    box-shadow: 0 6px 18px rgba(0,240,255,0.18);
                }
                .sh-cell:hover:not(.sh-cell-revealed) .sh-cell-icon {
                    opacity: 0.7;
                    transform: scale(1.15);
                }
                .sh-cell:hover:not(.sh-cell-revealed)::before { opacity: 1; }

                /* Safe reveal */
                .sh-cell.sh-star {
                    background: rgba(0,240,255,0.12);
                    border-color: var(--neon-blue);
                    box-shadow: 0 0 18px rgba(0,240,255,0.3), inset 0 0 12px rgba(0,240,255,0.15);
                    cursor: default;
                    animation: sh-pop-blue 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .sh-cell.sh-star .sh-cell-icon { opacity: 1; transform: scale(1); }
                @keyframes sh-pop-blue {
                    0%  { transform: scale(0.8); background: rgba(0,240,255,0.7); }
                    60% { transform: scale(1.1); }
                    100%{ transform: scale(1);   background: rgba(0,240,255,0.12); }
                }

                /* Star (safe) revealed after cashout/loss */
                .sh-cell.sh-star-revealed {
                    background: rgba(0,240,255,0.04);
                    border-color: rgba(0,240,255,0.2);
                    opacity: 0.55;
                    cursor: default;
                }

                /* Mine hit */
                .sh-cell.sh-mine-clicked {
                    background: rgba(255,51,102,0.2);
                    border-color: var(--danger);
                    box-shadow: 0 0 24px rgba(255,51,102,0.5), inset 0 0 14px rgba(255,51,102,0.25);
                    cursor: default;
                    animation: sh-pop-red 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes sh-pop-red {
                    0%  { transform: scale(0.8); background: rgba(255,51,102,0.9); }
                    60% { transform: scale(1.12); }
                    100%{ transform: scale(1);    background: rgba(255,51,102,0.2); }
                }

                /* Mine revealed passively */
                .sh-cell.sh-mine-revealed {
                    background: rgba(255,51,102,0.06);
                    border-color: rgba(255,51,102,0.25);
                    opacity: 0.55;
                    cursor: default;
                }

                /* How to play strip */
                .sh-how-to {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.8rem;
                    margin-top: 1.5rem;
                    padding: 1rem;
                    background: rgba(0,240,255,0.04);
                    border: 1px solid rgba(0,240,255,0.1);
                    border-radius: 12px;
                }
                .sh-how-icon {
                    font-size: 1.3rem;
                    flex-shrink: 0;
                    margin-top: 2px;
                }
                .sh-how-title {
                    font-family: var(--font-heading);
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--neon-blue);
                    margin-bottom: 0.25rem;
                }
                .sh-how-desc {
                    font-size: 0.78rem;
                    color: var(--text-muted);
                    line-height: 1.5;
                }

                /* ---- Right: Growth Curve ---- */
                .sh-growth-title {
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: var(--neon-blue);
                    text-transform: uppercase;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .sh-mult-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.7rem 0.9rem;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.3);
                    margin-bottom: 7px;
                    font-family: var(--font-heading);
                    font-size: 0.88rem;
                    font-weight: 700;
                    transition: all 0.25s ease;
                }
                .sh-mult-row:hover { border-color: rgba(0,240,255,0.2); }
                .sh-mult-row.sh-active {
                    background: var(--neon-blue);
                    color: #000;
                    border-color: var(--neon-blue);
                    box-shadow: 0 0 16px rgba(0,240,255,0.4);
                }
                .sh-mult-row.sh-next {
                    border-color: rgba(0,240,255,0.4);
                    border-style: dashed;
                    opacity: 0.85;
                }
                .sh-mult-value { color: var(--neon-blue); }
                .sh-mult-row.sh-active .sh-mult-value { color: #000; }

                .sh-current-mult {
                    margin-top: 1.5rem;
                    text-align: center;
                    padding: 1.2rem 0;
                    border-top: 1px solid rgba(255,255,255,0.06);
                }
                .sh-mult-number {
                    font-family: var(--font-heading);
                    font-size: 3rem;
                    font-weight: 900;
                    color: var(--text-main);
                    line-height: 1;
                }
                .sh-mult-label {
                    font-size: 0.65rem;
                    letter-spacing: 2px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    margin-top: 0.3rem;
                }
                .sh-payout-row {
                    margin-top: 1.2rem;
                    padding: 1rem;
                    background: rgba(0,0,0,0.35);
                    border: 1px solid rgba(0,240,255,0.12);
                    border-radius: 12px;
                }
                .sh-payout-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    color: var(--neon-blue);
                    text-transform: uppercase;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    margin-bottom: 0.3rem;
                }
                .sh-payout-value {
                    font-family: var(--font-heading);
                    font-size: 1.4rem;
                    font-weight: 900;
                    color: var(--text-main);
                }

                /* ---- Footer strip ---- */
                .sh-footer-strip {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-top: 2rem;
                    padding: 1.2rem 2rem;
                    background: rgba(10,12,20,0.8);
                    border: 1px solid rgba(0,240,255,0.1);
                    border-radius: 16px;
                }
                .sh-footer-item {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                }
                .sh-footer-icon {
                    font-size: 1.2rem;
                    opacity: 0.8;
                }
                .sh-footer-item-title {
                    font-family: var(--font-heading);
                    font-size: 0.75rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .sh-footer-item-sub {
                    font-size: 0.68rem;
                    color: var(--text-muted);
                    margin-top: 1px;
                }

                /* ---- Responsive ---- */
                @media (max-width: 1024px) {
                    .sh-layout {
                        grid-template-columns: 260px 1fr 240px;
                        gap: 1rem;
                    }
                    .sh-title { font-size: 2.2rem; }
                    .sh-footer-strip { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 768px) {
                    .sh-layout {
                        grid-template-columns: 1fr;
                    }
                    .sh-grid {
                        grid-template-columns: repeat(6, 1fr);
                        max-width: 100%;
                    }
                    .sh-header { flex-direction: column; text-align: center; }
                    .sh-footer-strip { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 480px) {
                    .sh-grid { gap: 5px; }
                    .sh-footer-strip { grid-template-columns: 1fr 1fr; gap: 0.75rem; padding: 1rem; }
                }
            `}</style>

            <div className="sh-page">
                {/* ---- HEADER ---- */}
                <div className="sh-header">
                    <button className="sh-back-btn" onClick={() => navigate('/hub')}>
                        ← Back to Hub
                    </button>
                    <div className="sh-title-wrap">
                        <div className="sh-title">⭐ Star Hunt</div>
                        <div className="sh-subtitle">Find the fortune boxes and win big rewards!</div>
                    </div>
                    <div className="sh-boxes-badge">
                        🎁 30 BOXES
                    </div>
                </div>

                {/* ---- 3-COLUMN LAYOUT ---- */}
                <div className="sh-layout">

                    {/* ======= LEFT: SETTINGS ======= */}
                    <div className="sh-panel">
                        <div className="sh-settings-title">Game Settings</div>

                        {/* Stake Input */}
                        <div className="sh-field">
                            <label className="sh-label">Stake HBAR</label>
                            <div className="sh-input-row">
                                <input
                                    type="number"
                                    value={betAmount}
                                    onChange={e => setBetAmount(e.target.value)}
                                    disabled={gameState === 'playing'}
                                />
                                <span className="sh-input-suffix">HBAR</span>
                            </div>
                        </div>

                        {/* Mines Count Input */}
                        <div className="sh-field">
                            <label className="sh-label">Hazard Risk</label>
                            <div className="sh-input-row">
                                <input
                                    type="number"
                                    value={minesCount}
                                    onChange={e => setMinesCount(Math.min(29, parseInt(e.target.value) || 1))}
                                    disabled={gameState === 'playing'}
                                />
                                <span className="sh-input-suffix">💣</span>
                            </div>
                            {/* Risk visual bar */}
                            <div className="sh-risk-bar" style={{ marginTop: '0.7rem' }}>
                                {['#00e676','#69f0ae','#ffeb3b','#ffa726','#f44336','#d32f2f'].map((color, i) => (
                                    <div
                                        key={i}
                                        className="sh-risk-segment"
                                        style={{
                                            background: color,
                                            opacity: Math.ceil(minesCount / 5) > i ? 1 : 0.2
                                        }}
                                    />
                                ))}
                            </div>
                            <div className="sh-risk-labels">
                                <span>Low Risk</span>
                                <span className="high">High Risk</span>
                            </div>
                        </div>

                        {/* Action Button */}
                        {gameState === 'playing' ? (
                            <button
                                className="sh-start-btn cashout"
                                onClick={handleCashout}
                                disabled={loading || revealedCount === 0}
                            >
                                {loading ? 'Processing...' : `💰 Cash Out ${(parseFloat(betAmount) * currentMultiplier).toFixed(2)} HBAR`}
                            </button>
                        ) : (
                            <button
                                className="sh-start-btn start"
                                onClick={startGame}
                                disabled={loading}
                            >
                                {loading ? 'Opening Board...' : 'Start Game'}
                            </button>
                        )}

                        {/* Server Hash / Provably Fair */}
                        <div className="sh-fair-box">
                            <div className="sh-fair-label">Server Hash</div>
                            <div className="sh-fair-hash">{serverSeedHash || '0x0000...0000'}</div>
                            <div className="sh-fair-verified">
                                <span>🛡️</span>
                                <span>Provably Fair · Verified on Hedera Network</span>
                            </div>
                        </div>
                    </div>

                    {/* ======= CENTRE: GRID ======= */}
                    <div className="sh-panel">
                        <div className="sh-grid-panel-title">Find the 🎁 Fortune Boxes</div>
                        <div className="sh-grid-panel-sub">Avoid the bombs and find the rewards!</div>

                        <div className="sh-grid">
                            {Array.from({ length: 30 }).map((_, i) => {
                                const status = grid[i]?.status || 'covered';
                                let cellClass = 'sh-cell';
                                let icon = <span className="sh-cell-icon">☆</span>;

                                if (status === 'star') {
                                    cellClass += ' sh-star sh-cell-revealed';
                                    icon = <span style={{ fontSize: '1.4rem' }}>🎁</span>;
                                } else if (status === 'star_revealed') {
                                    cellClass += ' sh-star-revealed sh-cell-revealed';
                                    icon = <span style={{ fontSize: '1.4rem', opacity: 0.5 }}>🎁</span>;
                                } else if (status === 'mine_clicked') {
                                    cellClass += ' sh-mine-clicked sh-cell-revealed';
                                    icon = <span style={{ fontSize: '1.4rem' }}>💣</span>;
                                } else if (status === 'mine_revealed') {
                                    cellClass += ' sh-mine-revealed sh-cell-revealed';
                                    icon = <span style={{ fontSize: '1.4rem', opacity: 0.5 }}>💣</span>;
                                }

                                return (
                                    <div
                                        key={i}
                                        className={cellClass}
                                        onClick={() => handleCellClick(i)}
                                    >
                                        {icon}
                                    </div>
                                );
                            })}
                        </div>

                        {/* How to Play */}
                        <div className="sh-how-to">
                            <div className="sh-how-icon">ℹ️</div>
                            <div>
                                <div className="sh-how-title">How to Play</div>
                                <div className="sh-how-desc">
                                    Click on any box to reveal what's inside.<br />
                                    Find fortune boxes 🎁 and avoid bombs 💣
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ======= RIGHT: GROWTH CURVE ======= */}
                    <div className="sh-panel">
                        <div className="sh-growth-title">
                            📈 Growth Curve
                        </div>

                        {/* Multiplier rows */}
                        <div>
                            {Array(8).fill(null).map((_, i) => {
                                const step = revealedCount + (4 - i);
                                if (step <= 0 || step > (30 - minesCount)) return null;
                                const m = calculateMultiplier(minesCount, step);
                                const isActive = step === revealedCount;
                                const isNext = step === revealedCount + 1;
                                return (
                                    <div
                                        key={i}
                                        className={`sh-mult-row ${isActive ? 'sh-active' : ''} ${isNext ? 'sh-next' : ''}`}
                                    >
                                        <span>{step} 🎁</span>
                                        <span className="sh-mult-value">{m.toFixed(2)}x</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Current Multiplier Display */}
                        <div className="sh-current-mult">
                            <div className="sh-mult-number">{currentMultiplier.toFixed(2)}x</div>
                            <div className="sh-mult-label">Current Reward</div>
                        </div>

                        {/* Potential Payout */}
                        <div className="sh-payout-row">
                            <div className="sh-payout-label">
                                🪙 Potential Payout
                            </div>
                            <div className="sh-payout-value">
                                {(parseFloat(betAmount || 0) * currentMultiplier).toFixed(2)} HBAR
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---- FOOTER STRIP ---- */}
                <div className="sh-footer-strip">
                    <div className="sh-footer-item">
                        <div className="sh-footer-icon">🛡️</div>
                        <div>
                            <div className="sh-footer-item-title">Provably Fair</div>
                            <div className="sh-footer-item-sub">Verified on Hedera</div>
                        </div>
                    </div>
                    <div className="sh-footer-item">
                        <div className="sh-footer-icon">🔒</div>
                        <div>
                            <div className="sh-footer-item-title">Secure &amp; Safe</div>
                            <div className="sh-footer-item-sub">Your funds are protected</div>
                        </div>
                    </div>
                    <div className="sh-footer-item">
                        <div className="sh-footer-icon">⚡</div>
                        <div>
                            <div className="sh-footer-item-title">Instant Play</div>
                            <div className="sh-footer-item-sub">No waiting, play now</div>
                        </div>
                    </div>
                    <div className="sh-footer-item">
                        <div className="sh-footer-icon">🏆</div>
                        <div>
                            <div className="sh-footer-item-title">Big Rewards</div>
                            <div className="sh-footer-item-sub">Win up to 40x your stake</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Mines;
