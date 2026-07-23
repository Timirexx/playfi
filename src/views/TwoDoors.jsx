import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { ethers } from 'ethers';
import { useAppKitProvider } from '@reown/appkit/react';
import { TWO_DOORS_ADDRESS, TWO_DOORS_ABI } from '../contracts/TwoDoors';

const TwoDoors = () => {
    const navigate = useNavigate();
    const { isConnected, address, refreshBalance } = useWallet();
    const { walletProvider } = useAppKitProvider('eip155');
    
    const [betAmount, setBetAmount] = useState("1");
    const [isRunning, setIsRunning] = useState(false);
    
    const [isStaked, setIsStaked] = useState(false);
    const [wagerTxId, setWagerTxId] = useState(null);
    
    // UI States: null (waiting), 'opening' (animation), 'win', 'lose'
    const [gameState, setGameState] = useState(null);
    const [selectedDoor, setSelectedDoor] = useState(null);
    const [treasureDoor, setTreasureDoor] = useState(null);

    const handleStake = async () => {
        if (!isConnected || isRunning || !walletProvider) return;
        setIsRunning(true);
        setGameState(null);
        setSelectedDoor(null);
        setTreasureDoor(null);

        window.dispatchEvent(new CustomEvent('showTxOverlay', { 
            detail: { title: 'Two Doors', desc: 'Confirming your wager on-chain...' } 
        }));

        try {
            // 1. On-chain stake into the Two Doors treasury (placeBet).
            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const gameContract = new ethers.Contract(TWO_DOORS_ADDRESS, TWO_DOORS_ABI, signer);

            const valWei = ethers.parseUnits(betAmount, 18);
            const tx = await gameContract.placeBet({ value: valWei });

            window.dispatchEvent(new CustomEvent('showTxOverlay', {
                detail: { title: 'Verifying Wager', desc: 'Waiting for network confirmation...' }
            }));

            const receipt = await tx.wait();

            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
            window.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: `Stake Confirmed! Choose a door.`, type: 'success' }
            }));

            setWagerTxId(receipt.hash);
            setIsStaked(true);
            setIsRunning(false);

        } catch (err) {
            console.error("Stake Error:", err);
            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
            window.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: err.reason || err.message || 'Transaction failed', type: 'error' } 
            }));
            setIsRunning(false);
        }
    };

    const resetGame = () => {
        setIsRunning(false);
        setGameState(null);
        setSelectedDoor(null);
        setTreasureDoor(null);
        setIsStaked(false);
        setWagerTxId(null);
    };

    const handlePlay = async (doorNumber) => {
        if (!isStaked || !wagerTxId || isRunning || !walletProvider) return;
        setIsRunning(true);
        setSelectedDoor(doorNumber);

        try {
            // 2a. Commit the chosen door on-chain (chooseDoor). This is a wallet tx —
            // the door choice is recorded on the contract, no outcome decided yet.
            window.dispatchEvent(new CustomEvent('showTxOverlay', {
                detail: { title: `Door ${doorNumber}`, desc: 'Confirm your choice in your wallet...' }
            }));

            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const gameContract = new ethers.Contract(TWO_DOORS_ADDRESS, TWO_DOORS_ABI, signer);

            const chooseTx = await gameContract.chooseDoor(doorNumber);
            await chooseTx.wait();

            // 2b. Ask the backend keeper to trigger the on-chain PRNG reveal + payout.
            window.dispatchEvent(new CustomEvent('showTxOverlay', {
                detail: { title: 'Revealing...', desc: 'Rolling the on-chain randomness...' }
            }));
            setGameState('opening');

            const API_BASE = window.location.hostname === 'localhost' ? "http://localhost:3001" : "https://server-chi-rose-76.vercel.app";
            const response = await fetch(`${API_BASE}/api/twodoors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: address })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to resolve game");
            }

            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
            setTreasureDoor(data.treasureDoor);

            // Hold on the opening animation briefly, then reveal the result.
            setTimeout(() => {
                setGameState(data.isWin ? 'win' : 'lose');
                setIsRunning(false);
                setIsStaked(false);
                setWagerTxId(null);
                refreshBalance();

                if (data.isWin) {
                    const wonAmount = parseFloat(betAmount) * 2;
                    window.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: `You Won! You received ${wonAmount} HBAR.`, type: 'success' }
                    }));
                } else {
                    window.dispatchEvent(new CustomEvent('showToast', {
                        detail: { message: `You Lost! Better luck next time.`, type: 'error' }
                    }));
                }
            }, 1500);

        } catch (err) {
            console.error("Two Doors Error:", err);
            window.dispatchEvent(new CustomEvent('hideTxOverlay'));
            window.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: err.reason || err.message || 'Something went wrong', type: 'error' }
            }));
            // The stake is still live on-chain (game not resolved). Let the player
            // re-pick a door rather than wiping their staked game.
            setIsRunning(false);
            setGameState(null);
            setSelectedDoor(null);
        }
    };

    const renderDoor = (doorNumber) => {
        const isSelected = selectedDoor === doorNumber;
        const isOpening = gameState === 'opening' && isSelected;
        const isRevealed = gameState === 'win' || gameState === 'lose';
        const hasTreasure = isRevealed && treasureDoor === doorNumber;
        const isWinnerDoor = hasTreasure;

        let borderColor = 'rgba(255,255,255,0.1)';
        if (isSelected) borderColor = 'rgba(0, 240, 255, 0.8)';
        if (isRevealed) {
            if (hasTreasure) borderColor = '#00ffaa'; // Green for treasure
            else if (isSelected && !hasTreasure) borderColor = '#ff003c'; // Red for wrong pick
        }

        return (
            <div 
                key={doorNumber}
                onClick={() => isStaked && !isRunning && handlePlay(doorNumber)}
                className={`td-door-card ${isOpening ? 'door-shake' : ''}`}
                style={{ 
                    borderColor: borderColor,
                    cursor: (!isStaked || isRunning) ? 'not-allowed' : 'pointer',
                    boxShadow: isWinnerDoor ? '0 0 30px rgba(0, 255, 170, 0.3) inset, 0 0 20px rgba(0, 255, 170, 0.4)' : (isSelected ? '0 0 20px rgba(0, 240, 255, 0.3) inset' : 'none'),
                    opacity: (!isStaked && !isRevealed) ? 0.7 : 1
                }}
            >
                <div className="td-door-stage">
                    <div className="td-glow-platform"></div>
                    
                    <div className="td-behind-door">
                        <span style={{ fontSize: '3.5rem', opacity: isRevealed ? 1 : 0, transform: isRevealed ? 'scale(1)' : 'scale(0.5)', transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                            {isRevealed ? (hasTreasure ? '💰' : '💨') : ''}
                        </span>
                    </div>

                    <div className={`td-door-body ${isRevealed ? 'is-open' : ''}`}>
                        <div className="td-door-panel top-panel"></div>
                        <div className="td-door-panel bottom-panel"></div>
                        <div className="td-door-knob"></div>
                    </div>
                </div>
                
                <div className="td-door-label">
                    DOOR {doorNumber}
                </div>
            </div>
        );
    };

    return (
        <div className="view section-active">
            <style>{`
                /* =============================================
                   TWO DOORS — PREMIUM REDESIGN
                ============================================= */
                .td-layout {
                    max-width: 1000px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .td-back-btn {
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
                    width: fit-content;
                }

                .td-back-btn:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.25);
                    transform: translateX(-2px);
                }

                .td-main-card {
                    background: rgba(5, 7, 12, 0.85);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 240, 255, 0.2);
                    border-radius: 20px;
                    padding: 3rem 0 0 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                }

                /* TITLE SECTION */
                .td-title-section {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 0.5rem;
                }

                .td-icon-wrap {
                    font-size: 2.5rem;
                    line-height: 1;
                    filter: drop-shadow(0 0 10px rgba(0,240,255,0.6));
                    color: transparent;
                    text-shadow: 0 0 0 var(--neon-blue);
                }

                .td-title {
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
                    animation: td-shimmer 4s linear infinite;
                    text-transform: uppercase;
                }
                
                @keyframes td-shimmer {
                    0%   { background-position: 0% center; }
                    100% { background-position: 200% center; }
                }

                .td-subtitle {
                    color: var(--text-muted);
                    font-size: 1.1rem;
                    margin-bottom: 2.5rem;
                    text-align: center;
                }

                /* BET INPUT */
                .td-bet-section {
                    width: 100%;
                    max-width: 400px;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-bottom: 2rem;
                }

                .td-bet-section label {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    margin-left: 0.5rem;
                }

                .td-input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(0, 240, 255, 0.3);
                    border-radius: 8px;
                    padding: 0.5rem 1rem;
                    transition: all 0.3s ease;
                }

                .td-input-wrapper:focus-within {
                    border-color: var(--neon-blue);
                    box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
                }

                .td-input-wrapper input {
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-family: var(--font-heading);
                    font-size: 1.2rem;
                    width: 100%;
                    outline: none;
                }

                .td-input-currency {
                    color: var(--text-muted);
                    font-family: var(--font-heading);
                    font-weight: 700;
                    font-size: 1rem;
                }

                .td-stake-btn {
                    width: 100%;
                    padding: 1rem;
                    font-size: 1.2rem;
                    margin-top: 0.5rem;
                    border-radius: 8px;
                    background: var(--neon-blue);
                    color: #000;
                    border: none;
                    font-family: var(--font-heading);
                    font-weight: 800;
                    cursor: pointer;
                    box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
                    transition: all 0.3s ease;
                }

                .td-stake-btn:hover:not(:disabled) {
                    box-shadow: 0 0 30px rgba(0, 240, 255, 0.7);
                    transform: translateY(-2px);
                }

                .td-stake-btn:disabled {
                    background: rgba(0, 240, 255, 0.2);
                    color: rgba(255,255,255,0.5);
                    cursor: not-allowed;
                    box-shadow: none;
                    transform: none;
                }

                /* DIVIDER */
                .td-divider {
                    width: 80%;
                    max-width: 600px;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin: 2rem 0;
                    color: var(--neon-blue);
                    font-family: var(--font-heading);
                    font-weight: 700;
                    letter-spacing: 1px;
                }

                .td-divider::before,
                .td-divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.5), transparent);
                }

                /* DOORS CONTAINER */
                .td-doors-container {
                    display: flex;
                    gap: 2rem;
                    margin-bottom: 3rem;
                    justify-content: center;
                    flex-wrap: wrap;
                }

                .td-door-card {
                    width: 240px;
                    height: 280px;
                    background: rgba(15, 20, 30, 0.6);
                    border: 1px solid rgba(0, 240, 255, 0.1);
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.5rem;
                    position: relative;
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .td-door-card:hover:not([style*="not-allowed"]) {
                    transform: translateY(-5px);
                    border-color: rgba(0, 240, 255, 0.5);
                    background: rgba(15, 20, 30, 0.9);
                }

                /* 3D DOOR CSS */
                .td-door-stage {
                    position: relative;
                    width: 100px;
                    height: 160px;
                    margin-top: 1rem;
                    display: flex;
                    justify-content: center;
                    align-items: flex-end;
                    perspective: 800px;
                }

                .td-glow-platform {
                    position: absolute;
                    bottom: -15px;
                    width: 160px;
                    height: 30px;
                    border-radius: 50%;
                    background: radial-gradient(ellipse at center, rgba(0, 240, 255, 0.4) 0%, rgba(0,0,0,0) 70%);
                    border: 1px solid rgba(0,240,255,0.1);
                    transform: rotateX(70deg);
                    box-shadow: 0 0 20px rgba(0,240,255,0.2);
                }

                .td-behind-door {
                    position: absolute;
                    bottom: 20px;
                    left: 0;
                    width: 100%;
                    height: 120px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1;
                }

                .td-door-body {
                    position: absolute;
                    bottom: 0;
                    width: 90px;
                    height: 150px;
                    background: linear-gradient(135deg, #7c4c26, #4a2810);
                    border: 2px solid #361b0a;
                    border-radius: 4px;
                    z-index: 2;
                    transform-origin: left;
                    transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: space-around;
                    padding: 0.5rem 0;
                    box-shadow: inset 0 0 10px rgba(0,0,0,0.5), 5px 5px 15px rgba(0,0,0,0.5);
                }

                .td-door-body.is-open {
                    transform: rotateY(-105deg);
                }

                .td-door-panel {
                    width: 70%;
                    height: 40%;
                    border: 2px solid #5a3417;
                    background: rgba(0,0,0,0.1);
                    border-radius: 2px;
                }

                .td-door-knob {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    width: 10px;
                    height: 10px;
                    background: #d4af37; /* Gold */
                    border-radius: 50%;
                    box-shadow: 1px 1px 3px rgba(0,0,0,0.6);
                }

                .td-door-label {
                    font-family: var(--font-heading);
                    color: var(--neon-blue);
                    font-weight: 800;
                    font-size: 1.1rem;
                    letter-spacing: 1px;
                }

                /* FOOTER STATS */
                .td-footer-stats {
                    width: 100%;
                    display: grid;
                    grid-template-columns: 1fr 1fr 1.5fr;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.3);
                }

                .td-stat-box {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.5rem 2rem;
                }

                .td-stat-box.border-left {
                    border-left: 1px solid rgba(255,255,255,0.05);
                }

                .td-stat-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 1px solid var(--neon-blue);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    box-shadow: 0 0 10px rgba(0,240,255,0.2) inset;
                    flex-shrink: 0;
                }

                .td-stat-label {
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    margin-bottom: 0.3rem;
                }

                .td-stat-val {
                    font-weight: 700;
                    font-size: 1.1rem;
                }
                
                .td-stat-val.text-yellow {
                    color: #ffb800;
                }

                @media (max-width: 800px) {
                    .td-footer-stats {
                        grid-template-columns: 1fr;
                    }
                    .td-stat-box.border-left {
                        border-left: none;
                        border-top: 1px solid rgba(255,255,255,0.05);
                    }
                }

                /* GAME STATES & ANIMATIONS */
                .door-shake .td-door-body {
                    animation: td-shake 0.5s infinite;
                }
                @keyframes td-shake {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    25% { transform: translate(-2px, -1px) rotate(-1deg); }
                    50% { transform: translate(1px, 0px) rotate(1deg); }
                    75% { transform: translate(-1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -1px) rotate(-1deg); }
                }
                
                .td-result-msg {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 2rem;
                    animation: fade-in-up 0.5s ease forwards;
                }
                
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

            `}</style>

            <div className="td-layout">
                <button className="td-back-btn" onClick={() => navigate('/hub')}>
                    &larr; Back to Hub
                </button>
                
                <div className="td-main-card">
                    
                    <div className="td-title-section">
                        <div className="td-icon-wrap">🚪</div>
                        <h2 className="td-title">TWO DOORS</h2>
                    </div>
                    <p className="td-subtitle">Double your HBAR or lose it all. Pick the door with the treasure!</p>

                    {!isStaked && (
                        <div className="td-bet-section">
                            <label>Bet Amount (HBAR)</label>
                            <div className="td-input-wrapper">
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={(e) => setBetAmount(e.target.value)}
                                    min="1" 
                                    disabled={isRunning}
                                />
                                <span className="td-input-currency">HBAR</span>
                            </div>
                            <button 
                                className="td-stake-btn"
                                onClick={handleStake}
                                disabled={isRunning}
                            >
                                {isRunning ? 'STAKING...' : 'STAKE HBAR'}
                            </button>
                        </div>
                    )}

                    {isStaked && !gameState && (
                        <div style={{ color: '#00ffaa', marginBottom: '2rem', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '0 0 10px rgba(0,255,170,0.5)' }}>
                            Staked {betAmount} HBAR! Select your door.
                        </div>
                    )}

                    {gameState === 'opening' && (
                        <div style={{ color: 'var(--neon-blue)', marginBottom: '2rem', fontWeight: 'bold', fontSize: '1.2rem', animation: 'td-shake 1s infinite' }}>
                            Opening Door {selectedDoor}...
                        </div>
                    )}

                    <div className="td-divider">
                        <span>CHOOSE A DOOR</span>
                    </div>

                    <div className="td-doors-container">
                        {renderDoor(1)}
                        {renderDoor(2)}
                    </div>

                    {gameState === 'win' && (
                        <div className="td-result-msg" style={{ color: '#00ffaa' }}>
                            You found the treasure! 💰
                        </div>
                    )}
                    {gameState === 'lose' && (
                        <div className="td-result-msg" style={{ color: '#ff003c' }}>
                            Empty! Better luck next time. 💨
                        </div>
                    )}

                    {(gameState === 'win' || gameState === 'lose') && (
                        <button 
                            className="td-stake-btn" 
                            style={{ maxWidth: '200px', marginBottom: '2rem' }}
                            onClick={resetGame}
                        >
                            PLAY AGAIN
                        </button>
                    )}

                    <div className="td-footer-stats">
                        <div className="td-stat-box">
                            <div className="td-stat-icon">🪙</div>
                            <div>
                                <div className="td-stat-label">Potential Win</div>
                                <div className="td-stat-val text-yellow">{(parseFloat(betAmount) || 0) * 2} HBAR</div>
                            </div>
                        </div>
                        <div className="td-stat-box border-left">
                            <div className="td-stat-icon">🛡️</div>
                            <div>
                                <div className="td-stat-label">Risk</div>
                                <div className="td-stat-val text-yellow">Lose your bet</div>
                            </div>
                        </div>
                        <div className="td-stat-box border-left" style={{ flexGrow: 1.5 }}>
                            <div className="td-stat-icon">ℹ️</div>
                            <div>
                                <div className="td-stat-label">How it works</div>
                                <div className="td-stat-val text-muted" style={{ fontWeight: 400, fontSize: '0.9rem', lineHeight: 1.4 }}>
                                    Pick a door. If there's treasure behind it, you win 2x your bet!
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default TwoDoors;
