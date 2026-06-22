import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { ethers } from 'ethers';
import { useAppKitProvider } from '@reown/appkit/react';
import { GAME_TREASURY_ADDRESS, GAME_TREASURY_ABI } from '../contracts/GameTreasury';

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
            // 1. On-Chain Buy-In
            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner();
            const vaultContract = new ethers.Contract(GAME_TREASURY_ADDRESS, GAME_TREASURY_ABI, signer);

            const valWei = ethers.parseUnits(betAmount, 18);
            const tx = await vaultContract.placeBet({ value: valWei });
            
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

    const handlePlay = async (doorNumber) => {
        if (!isStaked || !wagerTxId || isRunning) return;
        setIsRunning(true);
        setSelectedDoor(doorNumber);
        setGameState('opening');

        try {
            // 2. Call Backend API
            const API_BASE = window.location.hostname === 'localhost' ? "http://localhost:3001" : "https://server-chi-rose-76.vercel.app";
            const response = await fetch(`${API_BASE}/api/twodoors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionId: wagerTxId,
                    userAddress: address,
                    betAmount: betAmount,
                    selectedDoor: doorNumber
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || "Failed to verify transaction");
            }

            setTreasureDoor(data.treasureDoor);

            // Wait 1.5s for opening animation, then show result
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
            console.error("Two Doors API Error:", err);
            window.dispatchEvent(new CustomEvent('showToast', { 
                detail: { message: err.reason || err.message || 'Verification failed', type: 'error' } 
            }));
            setIsRunning(false);
            setGameState(null);
            setSelectedDoor(null);
            setIsStaked(false);
            setWagerTxId(null);
        }
    };

    const renderDoor = (doorNumber) => {
        const isSelected = selectedDoor === doorNumber;
        const isOpening = gameState === 'opening' && isSelected;
        const isRevealed = gameState === 'win' || gameState === 'lose';
        const hasTreasure = isRevealed && treasureDoor === doorNumber;
        const isWinnerDoor = hasTreasure;

        let doorContent = "🚪";
        if (isRevealed) {
            doorContent = hasTreasure ? "💰" : "💨"; // Money bag vs smoke/empty
        }

        let borderColor = 'rgba(255,255,255,0.2)';
        if (isSelected) borderColor = '#00f0ff';
        if (isRevealed) {
            if (hasTreasure) borderColor = '#00ffaa'; // Green for treasure
            else if (isSelected && !hasTreasure) borderColor = '#ff003c'; // Red for wrong pick
        }

        return (
            <div 
                onClick={() => isStaked && !isRunning && handlePlay(doorNumber)}
                className={`door-container ${isOpening ? 'door-shake' : ''}`}
                style={{ 
                    width: '120px', 
                    height: '180px', 
                    border: `3px dashed ${borderColor}`, 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: isSelected ? 'rgba(0, 240, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    cursor: (!isStaked || isRunning) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: isWinnerDoor ? '0 0 20px rgba(0, 255, 170, 0.5)' : 'none',
                    transform: isSelected && !isRevealed ? 'scale(1.05)' : 'scale(1)',
                    opacity: (!isStaked && !isRevealed) ? 0.5 : 1
                }}
            >
                <span style={{ 
                    fontSize: '4rem',
                    transition: 'all 0.5s ease',
                    opacity: isOpening ? 0.5 : 1,
                    transform: isRevealed ? 'scale(1.2)' : 'scale(1)'
                }}>
                    {doorContent}
                </span>
            </div>
        );
    };

    return (
        <div className="view section-active">
            <button className="btn btn-glow" onClick={() => navigate('/')} style={{ marginBottom: '2rem' }}>&larr; Back to Hub</button>
            
            <div className="two-doors-wrapper" style={{ marginTop: '2rem' }}>
                <div className="two-doors-card glass-panel" style={{ 
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '2rem',
                    background: 'rgba(5, 5, 8, 0.8)'
                }}>
                    <h2 className="neon-text outline-text text-center" style={{ marginBottom: '1rem' }}>TWO DOORS</h2>
                    <p style={{ color: '#aaa', marginBottom: '2rem', textAlign: 'center' }}>
                        Double your HBAR or lose it all. Pick the door with the treasure!
                    </p>

                    {!isStaked && (
                        <div className="bet-input-group" style={{ width: '100%', maxWidth: '300px', marginBottom: '1rem' }}>
                            <label>Bet Amount (HBAR)</label>
                            <div className="input-wrapper">
                                <input 
                                    type="number" 
                                    value={betAmount} 
                                    onChange={(e) => setBetAmount(e.target.value)}
                                    min="1" 
                                    disabled={isRunning}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #00f0ff', borderRadius: '4px' }}
                                />
                                <span className="input-currency">HBAR</span>
                            </div>
                            <button 
                                className="btn btn-hero btn-glow" 
                                onClick={handleStake}
                                disabled={isRunning}
                                style={{ width: '100%', marginTop: '1rem' }}
                            >
                                {isRunning ? 'Staking...' : 'Stake HBAR'}
                            </button>
                        </div>
                    )}

                    {isStaked && !gameState && (
                        <div style={{ color: '#00ffaa', marginBottom: '1rem', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                            Staked {betAmount} HBAR! Now, select a door.
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '3rem', margin: '1rem 0' }}>
                        {renderDoor(1)}
                        {renderDoor(2)}
                    </div>
                    
                    {gameState === 'opening' && (
                        <p style={{ color: '#00f0ff', marginTop: '2rem', animation: 'pulse 1s infinite' }}>Opening Door {selectedDoor}...</p>
                    )}
                    {gameState === 'win' && (
                        <p style={{ color: '#00ffaa', marginTop: '2rem', fontSize: '1.2rem', fontWeight: 'bold' }}>You found the treasure! 💰</p>
                    )}
                    {gameState === 'lose' && (
                        <p style={{ color: '#ff003c', marginTop: '2rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Empty! Better luck next time. 💨</p>
                    )}
                    
                    {(gameState === 'win' || gameState === 'lose') && (
                        <button 
                            className="btn btn-glow" 
                            style={{ marginTop: '2rem' }}
                            onClick={() => {
                                setGameState(null);
                                setSelectedDoor(null);
                                setTreasureDoor(null);
                            }}
                        >
                            Play Again
                        </button>
                    )}
                </div>
            </div>
            
            <style jsx="true">{`
                @keyframes pulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
                .door-shake {
                    animation: shake 0.5s infinite;
                }
                @keyframes shake {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
            `}</style>
        </div>
    );
};

export default TwoDoors;
