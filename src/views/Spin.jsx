import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { ethers } from 'ethers';
import { useAppKitProvider } from '@reown/appkit/react';
import { GAME_TREASURY_ADDRESS, GAME_TREASURY_ABI } from '../contracts/GameTreasury';

const Spin = () => {
    const navigate = useNavigate();
    const { isConnected, address, updateStarPoints } = useWallet();
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
            const userBal = await vaultContract.userBalances(address);
            
            if (userBal < valWei) {
                const diff = valWei - userBal;
                const tx = await vaultContract.deposit({ value: diff });
                await tx.wait();
            }

            // 2. Fetch result from backend
            const response = await fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: address,
                    betAmount: parseFloat(betAmount),
                    prediction: prediction
                })
            });
            const data = await response.json();

            if (data.success) {
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
                        setResult(data.landedMultiplier);
                        if (data.isWin) {
                            window.dispatchEvent(new CustomEvent('showToast', { 
                                detail: { message: `🎉 YOU WON! Received ${data.landedMultiplier} Payout!`, type: 'success' } 
                            }));
                        }
                    }
                };
                requestAnimationFrame(animate);
            }
        } catch (err) {
            console.error("Spin Error:", err);
            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
            setIsRunning(false);
        }
    };

    return (
        <div className="view section-active">
            <button className="btn btn-glow" onClick={() => navigate('/')} style={{ marginBottom: '2rem' }}>&larr; Back to Hub</button>
            <div className="hero-section">
                <div className="hero-header">
                    <h2 className="neon-text outline-text text-center" style={{ width: '100%' }}>SPIN TO WIN</h2>
                </div>
                
                <div className="crash-container">
                    <div className="crash-graph" style={{ position: 'relative' }}>
                        <div className="wheel-pointer"></div>
                        <canvas ref={canvasRef} width="300" height="300"></canvas>
                        <div className={`multiplier-display ${result !== '-' ? '' : 'hidden'}`} style={{ fontSize: '3rem' }}>{result}</div>
                    </div>
                    
                    <div className="crash-controls glass-panel">
                        <div className="bet-input-group">
                            <label>Bet Amount (HBAR)</label>
                            <div className="input-wrapper">
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={(e) => setBetAmount(e.target.value)}
                                    min="1" 
                                />
                                <span className="input-currency">HBAR</span>
                            </div>
                        </div>
                        <div className="bet-input-group" style={{ marginTop: '1rem' }}>
                            <label>Predict Multiplier</label>
                            <select 
                                value={prediction} 
                                onChange={(e) => setPrediction(e.target.value)}
                                className="input-wrapper" 
                                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', color: 'white' }}
                            >
                                <option value="1x">1x</option>
                                <option value="2x">2x</option>
                                <option value="4x">4x</option>
                                <option value="5x">5x</option>
                                <option value="10x">10x</option>
                            </select>
                        </div>
                        <button 
                            className="btn btn-hero btn-glow" 
                            onClick={handleSpin}
                            disabled={isRunning}
                        >
                            {isRunning ? 'Spinning...' : 'Spin Wheel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Spin;
