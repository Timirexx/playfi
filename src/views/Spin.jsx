import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { ethers } from 'ethers';
import { useAppKitProvider } from '@reown/appkit/react';
import { GAME_TREASURY_ADDRESS, GAME_TREASURY_ABI } from '../contracts/GameTreasury';

const Spin = () => {
    const navigate = useNavigate();
    const { isConnected, address, updateStarPoints, refreshBalance } = useWallet();
    const { walletProvider } = useAppKitProvider('eip155');
    const canvasRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false);
    const [betAmount, setBetAmount] = useState("1");
    const [prediction, setPrediction] = useState("2x");
    const [result, setResult] = useState("-");

    const layout = [
        '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', '1x', '2x', '1x', '4x', 
        '1x', '2x', '1x', '10x', '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', 
        '1x', '2x', '1x', '4x', '1x', '2x', '1x', '20x', '1x', '2x', '1x', '40x'
    ];

    const colors = {
        '1x': '#00f0ff',
        '2x': '#ffea00',
        '4x': '#ff3366',
        '5x': '#00e676',
        '10x': '#f7b733',
        '20x': '#9d50bb',
        '40x': '#ffffff'
    };

    const API_BASE = window.location.hostname === 'localhost' ? "http://localhost:3001" : "https://server-chi-rose-76.vercel.app";

    const drawWheel = useCallback((rotation = 0) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = cx - 10;
        const sliceAngle = (2 * Math.PI) / layout.length;

        ctx.clearRect(0, 0, width, height);
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2 + rotation); 
        ctx.translate(-cx, -cy);

        for (let i = 0; i < layout.length; i++) {
            const mult = layout[i];
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.fillStyle = colors[mult] || '#333';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#050508';
            ctx.stroke();

            // Text
            if (mult !== '1x' || i % 2 === 0) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(startAngle + sliceAngle / 2);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#050508';
                ctx.font = 'bold 12px Outfit';
                ctx.fillText(mult, radius - 15, 4);
                ctx.restore();
            }
        }
        ctx.restore();

        // Hub
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, 2 * Math.PI);
        ctx.fillStyle = '#050508';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();
    }, [layout, colors]);

    useEffect(() => {
        drawWheel();
    }, [drawWheel]);

    const handleSpin = async () => {
        if (!isConnected || isRunning || !walletProvider) return;
        setIsRunning(true);
        setResult("-");

        window.dispatchEvent(new CustomEvent('showTxOverlay', { 
            detail: { title: 'Spin to Win', desc: 'Confirming your wager on-chain...' } 
        }));

        try {
            // 1. On-Chain Buy-In
            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const vaultContract = new ethers.Contract(GAME_TREASURY_ADDRESS, GAME_TREASURY_ABI, signer);

            const valWei = ethers.parseUnits(betAmount, 18);
            
            // Pay-per-game: Transfer exactly the bet amount directly to GameTreasury
            const tx = await vaultContract.placeBet({ value: valWei });
            await tx.wait();

            // 2. Fetch result from backend
            const response = await fetch(`${API_BASE}/api/spin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionId: tx.hash,
                    userAddress: address,
                    betAmount: parseFloat(betAmount),
                    prediction: prediction
                })
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to verify transaction");
            }

            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
                
                const targetIndex = data.targetIndex;
                const extraSpins = 360 * 5; // 5 full rotations
                const sliceDegrees = 360 / 36;
                const targetDegree = (360 - (targetIndex * sliceDegrees)) % 360;
                const finalRotation = (extraSpins + targetDegree) * (Math.PI / 180);

                let start = null;
                const duration = 4000;

                const animate = (time) => {
                    if (!start) start = time;
                    const progress = Math.min((time - start) / duration, 1);
                    const easeOut = 1 - Math.pow(1 - progress, 3);
                    const currentRot = finalRotation * easeOut;
                    
                    drawWheel(currentRot);

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        setIsRunning(false);
                        refreshBalance();
                        setResult(data.landedMultiplier);
                        if (data.isWin) {
                            const wonAmount = parseFloat(betAmount) * parseInt(data.landedMultiplier);
                            window.dispatchEvent(new CustomEvent('showToast', { 
                                detail: { message: `🎉 Congratulations! You won ${wonAmount} HBAR!`, type: 'success' } 
                            }));
                        } else {
                            window.dispatchEvent(new CustomEvent('showToast', { 
                                detail: { message: `😔 You lost ${betAmount} HBAR. Better luck next time!`, type: 'error' } 
                            }));
                        }
                    }
                };
                requestAnimationFrame(animate);
        } catch (err) {
            console.error("Spin Error:", err);
            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
            window.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: err.reason || err.message || 'Transaction failed', type: 'error' } 
            }));
            setIsRunning(false);
        }
    };

    return (
        <div className="view section-active">
            <style>{`
                /* =============================================
                   SPIN TO WIN — PREMIUM REDESIGN
                ============================================= */

                .stw-page {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1rem 3rem;
                }

                /* ---- Header ---- */
                .stw-header {
                    display: flex;
                    align-items: center;
                    position: relative;
                    padding: 1.5rem 0 2.5rem;
                }
                .stw-back-btn {
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
                }
                .stw-back-btn:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.25);
                    transform: translateX(-2px);
                }

                .stw-title-wrap {
                    text-align: center;
                    flex: 1;
                }
                .stw-title {
                    font-family: var(--font-heading);
                    font-size: clamp(2rem, 5vw, 3.5rem);
                    font-weight: 900;
                    letter-spacing: 4px;
                    background: linear-gradient(90deg, #00f0ff, #fff 50%, #00f0ff);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: stw-shimmer 4s linear infinite;
                    text-transform: uppercase;
                }
                @keyframes stw-shimmer {
                    0%   { background-position: 0% center; }
                    100% { background-position: 200% center; }
                }
                .stw-subtitle {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    margin-top: 0.3rem;
                }

                /* ---- 2-Column Layout ---- */
                .stw-layout {
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    gap: 1.5rem;
                    align-items: stretch;
                }

                .stw-panel {
                    background: rgba(10, 12, 20, 0.8);
                    border: 1px solid rgba(0, 240, 255, 0.12);
                    border-radius: 20px;
                    backdrop-filter: blur(16px);
                    padding: 2rem;
                    transition: border-color 0.3s ease;
                    display: flex;
                    flex-direction: column;
                }
                .stw-panel:hover {
                    border-color: rgba(0, 240, 255, 0.22);
                }

                /* ---- Left: Wheel ---- */
                .stw-wheel-container {
                    position: relative;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 450px;
                }
                .stw-pointer {
                    position: absolute;
                    top: 10px;
                    z-index: 10;
                    width: 0;
                    height: 0;
                    border-left: 20px solid transparent;
                    border-right: 20px solid transparent;
                    border-top: 35px solid var(--neon-blue);
                    filter: drop-shadow(0 0 10px var(--neon-blue-glow));
                }
                .stw-canvas-wrapper {
                    position: relative;
                    border-radius: 50%;
                    padding: 8px;
                    background: linear-gradient(135deg, rgba(0,240,255,0.2), transparent);
                    box-shadow: 0 0 40px rgba(0,240,255,0.1), inset 0 0 20px rgba(0,240,255,0.05);
                }
                canvas {
                    border-radius: 50%;
                    box-shadow: 0 0 30px rgba(0,0,0,0.5);
                }
                .stw-wheel-badge {
                    margin-top: 2rem;
                    padding: 0.8rem 1.5rem;
                    background: rgba(0,240,255,0.05);
                    border: 1px solid rgba(0,240,255,0.15);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                }
                .stw-wheel-badge-icon {
                    font-size: 1.5rem;
                    color: var(--neon-blue);
                }
                .stw-wheel-badge-text {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    line-height: 1.4;
                }
                .stw-wheel-badge-text strong {
                    color: var(--text-main);
                    font-weight: 700;
                }
                .stw-result-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.6);
                    border-radius: 50%;
                    backdrop-filter: blur(4px);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s;
                }
                .stw-result-overlay.show {
                    opacity: 1;
                }
                .stw-result-text {
                    font-family: var(--font-heading);
                    font-size: 4rem;
                    font-weight: 900;
                    color: var(--neon-blue);
                    text-shadow: 0 0 20px var(--neon-blue-glow);
                    animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes popIn {
                    0% { transform: scale(0.5); opacity: 0; }
                    80% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }

                /* ---- Right: Controls ---- */
                .stw-field {
                    margin-bottom: 1.5rem;
                }
                .stw-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    color: var(--neon-blue);
                    text-transform: uppercase;
                    margin-bottom: 0.8rem;
                    display: block;
                }
                
                .stw-input-row {
                    display: flex;
                    align-items: center;
                    background: rgba(0,0,0,0.5);
                    border: 1px solid rgba(0,240,255,0.15);
                    border-radius: 10px;
                    overflow: hidden;
                    transition: border-color 0.3s ease, box-shadow 0.3s ease;
                }
                .stw-input-row:focus-within {
                    border-color: rgba(0,240,255,0.5);
                    box-shadow: 0 0 0 3px rgba(0,240,255,0.08);
                }
                .stw-input-row input, .stw-input-row select {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    padding: 1rem 1.2rem;
                    color: var(--text-main);
                    font-family: var(--font-heading);
                    font-size: 1.1rem;
                    font-weight: 700;
                    -moz-appearance: textfield;
                }
                .stw-input-row select {
                    cursor: pointer;
                    appearance: none;
                }
                .stw-input-row input:disabled, .stw-input-row select:disabled {
                    opacity: 0.5;
                }
                .stw-input-suffix {
                    padding: 0 1.2rem;
                    color: var(--text-muted);
                    font-family: var(--font-heading);
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                
                /* Quick bets */
                .stw-quick-bets {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0.5rem;
                    margin-top: 0.8rem;
                }
                .stw-quick-btn {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 8px;
                    padding: 0.6rem;
                    color: var(--text-main);
                    font-family: var(--font-heading);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .stw-quick-btn:hover {
                    background: rgba(0,240,255,0.1);
                    border-color: rgba(0,240,255,0.3);
                }
                .stw-quick-btn.active {
                    background: var(--neon-blue);
                    color: #000;
                    border-color: var(--neon-blue);
                    box-shadow: 0 0 15px rgba(0,240,255,0.3);
                }

                /* Select dropdown arrow */
                .stw-select-wrapper {
                    position: relative;
                }
                .stw-select-wrapper::after {
                    content: '▼';
                    position: absolute;
                    right: 1.2rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--neon-blue);
                    pointer-events: none;
                    font-size: 0.8rem;
                }

                /* How to win box */
                .stw-info-box {
                    background: rgba(0,240,255,0.04);
                    border: 1px solid rgba(0,240,255,0.1);
                    border-radius: 12px;
                    padding: 1.2rem;
                    display: flex;
                    gap: 1rem;
                    align-items: flex-start;
                    margin: auto 0 1.5rem 0; /* Pushes to bottom */
                }
                .stw-info-icon {
                    font-size: 1.5rem;
                    color: var(--neon-blue);
                }
                .stw-info-title {
                    font-family: var(--font-heading);
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: var(--neon-blue);
                    margin-bottom: 0.3rem;
                }
                .stw-info-desc {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    line-height: 1.5;
                }

                /* Spin button */
                .stw-spin-btn {
                    width: 100%;
                    padding: 1.2rem;
                    border-radius: 12px;
                    border: none;
                    background: var(--neon-blue);
                    color: #000;
                    font-family: var(--font-heading);
                    font-size: 1.2rem;
                    font-weight: 900;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 0 20px rgba(0,240,255,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.8rem;
                    position: relative;
                    overflow: hidden;
                }
                .stw-spin-btn:hover:not(:disabled) {
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 0 35px rgba(0,240,255,0.6);
                }
                .stw-spin-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                    background: rgba(0,240,255,0.5);
                }
                .stw-spin-btn::before {
                    content: '';
                    position: absolute;
                    top: 0; left: -100%;
                    width: 60%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
                    transform: skewX(-20deg);
                    transition: left 0s;
                }
                .stw-spin-btn:hover:not(:disabled)::before {
                    left: 160%;
                    transition: left 0.5s ease;
                }
                .stw-spin-icon {
                    animation: spinIcon 3s linear infinite;
                }
                @keyframes spinIcon {
                    100% { transform: rotate(360deg); }
                }

                /* ---- Footer Stats ---- */
                .stw-footer {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    margin-top: 2rem;
                    padding: 1.5rem 2rem;
                    background: rgba(10,12,20,0.8);
                    border: 1px solid rgba(0,240,255,0.1);
                    border-radius: 16px;
                }
                .stw-stat-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    border-right: 1px solid rgba(255,255,255,0.06);
                    padding-right: 1.5rem;
                }
                .stw-stat-item:last-child {
                    border-right: none;
                }
                .stw-stat-icon {
                    font-size: 1.8rem;
                    color: var(--neon-blue);
                }
                .stw-stat-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    margin-bottom: 0.2rem;
                }
                .stw-stat-val {
                    font-family: var(--font-heading);
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .stw-stat-link {
                    color: var(--text-main);
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .stw-stat-link:hover {
                    color: var(--neon-blue);
                }

                /* ---- Responsive ---- */
                @media (max-width: 1024px) {
                    .stw-layout {
                        grid-template-columns: 1fr;
                    }
                    .stw-header {
                        justify-content: center;
                    }
                    .stw-back-btn {
                        position: static;
                    }
                    .stw-footer {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 1.5rem;
                    }
                    .stw-stat-item:nth-child(2) {
                        border-right: none;
                    }
                }
                @media (max-width: 640px) {
                    .stw-quick-bets {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .stw-footer {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                        padding: 1.5rem;
                    }
                    .stw-stat-item {
                        border-right: none;
                        padding-right: 0;
                    }
                    canvas {
                        width: 100%;
                        height: auto;
                        max-width: 350px;
                    }
                }
            `}</style>
            
            <div className="stw-page">
                {/* HEADER */}
                <div className="stw-header">
                    <button className="stw-back-btn" onClick={() => navigate('/hub')}>
                        ← Back to Hub
                    </button>
                    <div className="stw-title-wrap">
                        <div className="stw-title">Spin To Win</div>
                        <div className="stw-subtitle">Spin the wheel and hit your predicted multiplier to win!</div>
                    </div>
                </div>

                {/* 2-COLUMN LAYOUT */}
                <div className="stw-layout">
                    
                    {/* LEFT: WHEEL */}
                    <div className="stw-panel">
                        <div className="stw-wheel-container">
                            <div className="stw-pointer"></div>
                            <div className="stw-canvas-wrapper">
                                <canvas ref={canvasRef} width="350" height="350"></canvas>
                                <div className={`stw-result-overlay ${result !== '-' ? 'show' : ''}`}>
                                    <div className="stw-result-text">{result}</div>
                                </div>
                            </div>
                            
                            <div className="stw-wheel-badge">
                                <div className="stw-wheel-badge-icon">🏆</div>
                                <div className="stw-wheel-badge-text">
                                    <strong>Hit the exact multiplier</strong><br />
                                    to win your stake!
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: CONTROLS */}
                    <div className="stw-panel">
                        
                        {/* Bet Amount */}
                        <div className="stw-field">
                            <label className="stw-label">Bet Amount (HBAR)</label>
                            <div className="stw-input-row">
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={(e) => setBetAmount(e.target.value)}
                                    disabled={isRunning}
                                    min="0.1"
                                    step="0.1"
                                />
                                <span className="stw-input-suffix">HBAR</span>
                            </div>
                            <div className="stw-quick-bets">
                                {['0.1', '1', '10', '100'].map(val => (
                                    <button 
                                        key={val}
                                        className={`stw-quick-btn ${betAmount === val ? 'active' : ''}`}
                                        onClick={() => setBetAmount(val)}
                                        disabled={isRunning}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Predict Multiplier */}
                        <div className="stw-field">
                            <label className="stw-label">Predict Multiplier</label>
                            <div className="stw-input-row stw-select-wrapper">
                                <select 
                                    value={prediction} 
                                    onChange={(e) => setPrediction(e.target.value)}
                                    disabled={isRunning}
                                >
                                    <option value="1x">1x</option>
                                    <option value="2x">2x</option>
                                    <option value="4x">4x</option>
                                    <option value="5x">5x</option>
                                    <option value="10x">10x</option>
                                    <option value="20x">20x</option>
                                    <option value="40x">40x</option>
                                </select>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="stw-info-box">
                            <div className="stw-info-icon">🎯</div>
                            <div>
                                <div className="stw-info-title">How to Win</div>
                                <div className="stw-info-desc">
                                    Select a multiplier and spin.<br/>
                                    Hit the exact multiplier to win!
                                </div>
                            </div>
                        </div>

                        {/* Spin Button */}
                        <button 
                            className="stw-spin-btn" 
                            onClick={handleSpin}
                            disabled={isRunning}
                        >
                            {isRunning ? (
                                <>
                                    <span className="stw-spin-icon">↻</span> Spinning...
                                </>
                            ) : (
                                <>
                                    <span style={{ fontSize: '1.4rem' }}>↻</span> Spin Wheel
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* FOOTER STATS */}
                <div className="stw-footer">
                    <div className="stw-stat-item">
                        <div className="stw-stat-icon">🪙</div>
                        <div>
                            <div className="stw-stat-label">Your Balance</div>
                            <div className="stw-stat-val">125.50 HBAR</div>
                        </div>
                    </div>
                    <div className="stw-stat-item">
                        <div className="stw-stat-icon">📈</div>
                        <div>
                            <div className="stw-stat-label">Total Wagered</div>
                            <div className="stw-stat-val">2,450 HBAR</div>
                        </div>
                    </div>
                    <div className="stw-stat-item">
                        <div className="stw-stat-icon">🏆</div>
                        <div>
                            <div className="stw-stat-label">Total Won</div>
                            <div className="stw-stat-val">1,125 HBAR</div>
                        </div>
                    </div>
                    <div className="stw-stat-item">
                        <div className="stw-stat-icon">🕒</div>
                        <div>
                            <div className="stw-stat-label">Play History</div>
                            <div className="stw-stat-val">
                                <a href="#" className="stw-stat-link">View Stats &gt;</a>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Spin;

