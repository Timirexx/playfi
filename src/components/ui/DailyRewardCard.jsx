import React, { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';

const DailyRewardCard = () => {
    const { isConnected, lastClaimTime, claimDailyReward, connect } = useWallet();
    const [timeLeft, setTimeLeft] = useState(null);
    const [isClaiming, setIsClaiming] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = Date.now();
            const cooldown = 24 * 60 * 60 * 1000;
            const remaining = cooldown - (now - lastClaimTime);
            
            if (remaining > 0) {
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                
                setTimeLeft({
                    h: hours.toString().padStart(2, '0'),
                    m: minutes.toString().padStart(2, '0'),
                    s: seconds.toString().padStart(2, '0')
                });
            } else {
                setTimeLeft(null);
            }
        };

        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft();
        
        return () => clearInterval(timer);
    }, [lastClaimTime]);

    const handleClaim = () => {
        if (!isConnected) {
            connect();
            return;
        }

        setIsClaiming(true);
        const result = claimDailyReward();
        
        if (result.success) {
            // Instant feedback is handled by Context state update
            console.log("Claimed 50 Star Points!");
        }
        setIsClaiming(false);
    };

    return (
        <div className="daily-reward-card glass-panel">
            <div className="reward-content">
                <h3 className="reward-title">DAILY REWARDS</h3>
                <p className="reward-description">
                    Claim your daily gift of <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>50 Star Points</span>.
                </p>
                
                <button 
                    className="claim-btn"
                    disabled={timeLeft !== null || isClaiming}
                    onClick={handleClaim}
                >
                    {timeLeft ? 'CLAIMED' : 'CLAIM +50 PTS'}
                </button>

                {timeLeft && (
                    <div className="cooldown-text">
                        Next claim available in: <br/>
                        <span className="cooldown-timer">
                            {timeLeft.h}:{timeLeft.m}:{timeLeft.s}
                        </span>
                    </div>
                )}

                {!isConnected && (
                    <p className="cooldown-text" style={{ color: '#00f0ff' }}>
                        Connect wallet to start earning!
                    </p>
                )}
            </div>
        </div>
    );
};

export default DailyRewardCard;
