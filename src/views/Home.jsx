import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

const GameCard = ({ icon, title, description, onClick }) => (
  <div className="home-game-card glass-panel home-game-card-layout">
    <div className="home-game-card-header">
      <div className="home-game-icon">
        {icon}
      </div>
      <div>
        <h4 className="home-game-title">{title}</h4>
        <p className="home-game-desc">{description}</p>
      </div>
    </div>
    <button className="btn btn-hero btn-glow home-game-btn" onClick={onClick}>
      Play Now
    </button>
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const { address: userAddress, updateStarPoints } = useWallet();

  const [lastClaim, setLastClaim] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [successAnim, setSuccessAnim] = useState(false);

  useEffect(() => {
    if (!userAddress) return;
    const saved = localStorage.getItem(`playfi_daily_reward_${userAddress}`);
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

  const handleClaim = () => {
    if (!userAddress) {
      window.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Connect wallet to claim rewards", type: 'error' } }));
      return;
    }
    updateStarPoints(50);
    const now = Date.now();
    localStorage.setItem(`playfi_daily_reward_${userAddress}`, now.toString());
    setLastClaim(now);
    setSuccessAnim(true);
    setTimeout(() => setSuccessAnim(false), 2000);
    window.dispatchEvent(new CustomEvent('showToast', { detail: { message: "Claimed 50 Daily Stars! ⭐", type: 'success' } }));
  };

  return (
    <div className="view home-view section-active">
      
      {/* Hero Section */}
      <div className="hero-dashboard glass-panel">
        <div className="hero-dashboard-content">
          <p className="hero-dashboard-kicker">WELCOME TO PLAYFI</p>
          <h1 className="hero-dashboard-title">
            The Next Generation<br />
            of <span className="text-blue">Decentralized Gaming</span>
          </h1>
          <p className="hero-dashboard-subtitle">
            Play high-stakes games, earn rewards, and compete on the<br />
            Hedera network with full transparency.
          </p>
        </div>
        <div className="hero-dashboard-graphics">
           {/* Abstract graphics to simulate the 3D controller/coins */}
           <div className="hero-graphics-container">
             <div className="hero-graphics-controller">🎮</div>
             <div className="hero-graphics-coin">🪙</div>
           </div>
        </div>
      </div>

      {/* Daily Star Reward Section */}
      <style>{`
        .hm-daily-card {
            background: rgba(0, 240, 255, 0.03);
            border: 1px solid rgba(0, 240, 255, 0.15);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 4rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .hm-daily-card:hover {
            border-color: rgba(0, 240, 255, 0.4);
            box-shadow: 0 15px 40px rgba(0, 240, 255, 0.1);
        }
        .hm-daily-left {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            position: relative;
            z-index: 2;
        }
        .hm-daily-icon {
            font-size: 3.5rem;
            filter: drop-shadow(0 0 15px rgba(0, 240, 255, 0.5));
            animation: hm-float 3s ease-in-out infinite;
        }
        @keyframes hm-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .hm-daily-title {
            color: #00f0ff;
            font-family: var(--font-heading);
            font-size: 1.8rem;
            font-weight: 800;
            margin: 0 0 0.3rem 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .hm-daily-desc {
            color: var(--text-muted);
            margin: 0;
            font-size: 0.95rem;
        }
        .hm-daily-right {
            position: relative;
            z-index: 2;
            min-width: 200px;
            text-align: right;
        }
        .hm-claim-btn {
            background: linear-gradient(90deg, #00f0ff, #0080ff);
            border: none;
            color: #000;
            font-family: var(--font-heading);
            font-weight: 800;
            font-size: 1.1rem;
            padding: 1rem 2rem;
            border-radius: 100px;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .hm-claim-btn::after {
            content: '';
            position: absolute;
            top: 0; left: -100%;
            width: 50%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            transform: skewX(-20deg);
            animation: hm-shimmer 3s infinite;
        }
        @keyframes hm-shimmer {
            100% { left: 200%; }
        }
        .hm-claim-btn:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 0 30px rgba(0, 240, 255, 0.7);
            color: #fff;
        }
        .hm-countdown-wrap {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }
        .hm-countdown-label {
            font-size: 0.8rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.3rem;
        }
        .hm-countdown-time {
            font-family: var(--font-heading);
            font-size: 2.2rem;
            font-weight: 800;
            color: #fff;
            text-shadow: 0 0 10px rgba(255,255,255,0.3);
            letter-spacing: 2px;
        }
        .hm-success-anim {
            animation: hm-pulse-success 0.5s ease-out;
        }
        @keyframes hm-pulse-success {
            0% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 240, 255, 0); }
            50% { transform: scale(1.02); box-shadow: 0 0 50px rgba(0, 240, 255, 0.8); }
            100% { transform: scale(1); box-shadow: 0 0 20px rgba(0, 240, 255, 0.2); }
        }
        
        @media (max-width: 768px) {
            .hm-daily-card { flex-direction: column; text-align: center; gap: 1.5rem; padding: 1.5rem; }
            .hm-daily-left { flex-direction: column; gap: 1rem; }
            .hm-countdown-wrap { align-items: center; }
        }
      `}</style>
      <div className={`hm-daily-card ${successAnim ? 'hm-success-anim' : ''}`}>
        <div className="hm-daily-left">
            <div className="hm-daily-icon">🎁</div>
            <div>
                <h3 className="hm-daily-title">Daily Star Reward</h3>
                <p className="hm-daily-desc">Claim your free 50 Star Points every 24 hours.</p>
            </div>
        </div>
        <div className="hm-daily-right">
            {timeRemaining > 0 ? (
                <div className="hm-countdown-wrap">
                    <div className="hm-countdown-label">Next Reward In</div>
                    <div className="hm-countdown-time">{formatCountdown(timeRemaining)}</div>
                </div>
            ) : (
                <button className="hm-claim-btn" onClick={handleClaim}>
                    Claim 50 Stars
                </button>
            )}
        </div>
      </div>

      {/* Play Games Section */}
      <div className="home-section-container">
        <h2 className="home-section-title">PLAY <span style={{ color: '#00f0ff' }}>GAMES</span></h2>
        <p className="home-section-subtitle">Choose your game and start playing</p>
        <div className="home-games-grid">
          <GameCard 
            icon="💣" 
            title="Mines" 
            description="Uncover safe tiles and avoid the mines." 
            onClick={() => navigate('/mines')}
          />
          <GameCard 
            icon="🎡" 
            title="Spin to Win" 
            description="Spin the wheel and win up to 40x your bet." 
            onClick={() => navigate('/spin')}
          />
          <GameCard 
            icon="🚪" 
            title="Two Doors" 
            description="Pick a door and double your stake." 
            onClick={() => navigate('/two-doors')}
          />
        </div>
      </div>

      {/* Vault Section */}
      <div className="home-section-container">
        <h2 className="home-section-title uppercase">Vault</h2>
        <p className="home-section-subtitle">Stake your HBAR and earn Play Points</p>
        
        <div className="home-vault-container">
          {/* Main Vault Card */}
          <div className="home-vault-main-card glass-panel">
            <div className="home-vault-icon-large">
               🏦
            </div>
            <div className="home-vault-info">
              <h4 className="home-vault-title">Staking Vault</h4>
              <p className="home-vault-desc">Stake HBAR, earn Play Points, and climb the leaderboard.</p>
            </div>
            <button className="home-vault-action-btn" onClick={() => navigate('/vault')}>
              Stake Now
            </button>
          </div>
          
          {/* Stats Grid */}
          <div className="home-vault-stats-grid">
            <div className="vault-stat-card glass-panel">
              <div className="vault-stat-label">Total Staked</div>
              <div className="vault-stat-value">1,250 <span className="vault-stat-currency">HBAR</span></div>
            </div>
            <div className="vault-stat-card glass-panel">
              <div className="vault-stat-label">APY</div>
              <div className="vault-stat-value">12.5<span className="vault-stat-currency">%</span></div>
            </div>
            <div className="vault-stat-card glass-panel">
              <div className="vault-stat-label">Your Points</div>
              <div className="vault-stat-value">720 <span className="vault-stat-currency">PTS</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Section */}
      <div className="home-section-container" style={{ marginBottom: '4rem' }}>
        <style>{`
          .hm-lb-clickable {
            cursor: pointer;
            transition:
              transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275),
              box-shadow 0.3s ease,
              border-color 0.3s ease;
            position: relative;
            text-decoration: none;
            display: block;
          }
          .hm-lb-clickable:hover {
            transform: translateY(-6px);
            box-shadow: 0 16px 48px rgba(0, 240, 255, 0.18), 0 0 0 1px rgba(0, 240, 255, 0.35);
            border-color: rgba(0, 240, 255, 0.35) !important;
          }
          .hm-lb-clickable:active {
            transform: translateY(-2px);
          }
          .hm-lb-view-all {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 0.4rem;
            margin-top: 1.25rem;
            font-size: 0.85rem;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #00f0ff;
            opacity: 0.8;
            transition: opacity 0.2s ease, gap 0.2s ease;
          }
          .hm-lb-clickable:hover .hm-lb-view-all {
            opacity: 1;
            gap: 0.7rem;
          }
          .hm-lb-arrow {
            font-size: 1rem;
            transition: transform 0.25s ease;
          }
          .hm-lb-clickable:hover .hm-lb-arrow {
            transform: translateX(4px);
          }
        `}</style>

        <h2 className="home-section-title uppercase">Leaderboard</h2>
        <div className="home-leaderboard-header">
          <p className="home-leaderboard-subtitle">Top players on PlayFi</p>
          <div className="home-leaderboard-live">
            Updated Live <span className="live-indicator"></span>
          </div>
        </div>

        <div
          className="glass-panel home-leaderboard-panel hm-lb-clickable"
          onClick={() => navigate('/leaderboard')}
          role="button"
          aria-label="View Full Leaderboard"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/leaderboard')}
        >
          <div className="home-leaderboard-list">
            {/* Mock Leaderboard Items based on reference */}
            {[
              { rank: 1, address: '0xA78...12F3', pts: '12,450', isCrown: true },
              { rank: 2, address: '0x9C3...8D1E', pts: '9,870' },
              { rank: 3, address: '0xFAD...3A8B', pts: '7,850', isCrown: true },
              { rank: 4, address: '0x88E...1C7D', pts: '6,420' },
              { rank: 5, address: '0xD2F...489A', pts: '5,210' }
            ].map((player, idx) => (
              <div key={idx} className="home-leaderboard-item">
                <div className={`leaderboard-item-rank ${player.rank <= 3 ? 'top-rank' : ''}`}>{player.rank}</div>
                <div className={`leaderboard-item-avatar ${player.rank <= 3 ? 'top-avatar' : ''}`}></div>
                <div className="leaderboard-item-info">
                  <div className="leaderboard-item-address">
                    {player.isCrown && <span style={{ color: '#ffb800' }}>👑</span>} {player.address}
                  </div>
                  <div className="leaderboard-item-pts">{player.pts} PTS</div>
                </div>
              </div>
            ))}
          </div>

          <div className="hm-lb-view-all">
            View Full Leaderboard <span className="hm-lb-arrow">→</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="home-footer">
        <div>Built on Hedera ⓗ</div>
        <div>PlayFi © 2025. All rights reserved.</div>
        <div className="home-footer-socials">
          <span className="hover-white">🐦</span>
          <span className="hover-white">💬</span>
          <span className="hover-white">✈️</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
