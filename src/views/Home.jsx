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
      <style>{`
        /* ============================================
           HOME — PREMIUM LEADERBOARD PREVIEW
        ============================================ */
        .hm-lb-section {
          position: relative;
          margin-bottom: 4rem;
          overflow: hidden;
          border-radius: 28px;
          padding: 3rem 2.5rem;
          background: linear-gradient(135deg,
            rgba(0, 10, 20, 0.97) 0%,
            rgba(0, 20, 35, 0.95) 50%,
            rgba(0, 10, 20, 0.97) 100%);
          border: 1px solid rgba(0, 240, 255, 0.15);
          box-shadow:
            0 0 60px rgba(0, 240, 255, 0.06),
            0 30px 80px rgba(0, 0, 0, 0.5);
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .hm-lb-section:hover {
          border-color: rgba(0, 240, 255, 0.3);
          box-shadow:
            0 0 80px rgba(0, 240, 255, 0.12),
            0 30px 80px rgba(0, 0, 0, 0.5);
          transform: translateY(-4px);
        }
        .hm-lb-section:active { transform: translateY(-1px); }

        /* Animated background glow blobs */
        .hm-lb-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
          border-radius: 28px;
        }
        .hm-lb-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.12;
          animation: hm-lb-drift 12s ease-in-out infinite;
        }
        .hm-lb-blob-1 {
          width: 350px; height: 350px;
          background: #00f0ff;
          top: -80px; left: -60px;
          animation-delay: 0s;
        }
        .hm-lb-blob-2 {
          width: 280px; height: 280px;
          background: #0080ff;
          bottom: -60px; right: -40px;
          animation-delay: -5s;
        }
        .hm-lb-blob-3 {
          width: 200px; height: 200px;
          background: #7c3aed;
          top: 50%; right: 25%;
          animation-delay: -9s;
          opacity: 0.08;
        }
        @keyframes hm-lb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -15px) scale(1.05); }
          66% { transform: translate(-10px, 20px) scale(0.97); }
        }

        /* Floating particles */
        .hm-lb-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .hm-lb-particle {
          position: absolute;
          width: 2px; height: 2px;
          background: #00f0ff;
          border-radius: 50%;
          animation: hm-lb-float-up linear infinite;
          opacity: 0;
        }
        @keyframes hm-lb-float-up {
          0% { transform: translateY(100%) scale(0); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
        }

        /* Section top row */
        .hm-lb-toprow {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2.5rem;
        }
        .hm-lb-headline {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .hm-lb-eyebrow {
          font-size: 0.7rem;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #00f0ff;
          opacity: 0.7;
        }
        .hm-lb-heading {
          font-family: var(--font-heading);
          font-size: clamp(1.6rem, 3vw, 2.2rem);
          font-weight: 900;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin: 0;
          background: linear-gradient(90deg, #00f0ff, #fff 60%, #00f0ff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: hm-lb-shimmer 4s linear infinite;
        }
        @keyframes hm-lb-shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .hm-lb-live-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 1rem;
          background: rgba(0, 255, 136, 0.07);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #00ff88;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .hm-lb-live-dot {
          width: 6px; height: 6px;
          background: #00ff88;
          border-radius: 50%;
          box-shadow: 0 0 8px #00ff88;
          animation: hm-lb-pulse 2s ease-in-out infinite;
        }
        @keyframes hm-lb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        /* Top-3 Podium Grid */
        .hm-lb-podium {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: 1fr 1.15fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
          align-items: end;
        }
        .hm-lb-pod-card {
          border-radius: 20px;
          padding: 1.8rem 1.2rem 1.5rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .hm-lb-pod-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, currentColor, transparent);
          opacity: 0.5;
        }
        .hm-lb-pod-card:hover { transform: translateY(-6px); }

        /* Gold */
        .hm-lb-pod-gold {
          background: linear-gradient(160deg, rgba(255,215,0,0.08) 0%, rgba(0,0,0,0.5) 100%);
          border: 1px solid rgba(255,215,0,0.35);
          box-shadow: 0 10px 40px rgba(255,215,0,0.12);
          color: gold;
        }
        /* Silver */
        .hm-lb-pod-silver {
          background: linear-gradient(160deg, rgba(192,192,192,0.07) 0%, rgba(0,0,0,0.5) 100%);
          border: 1px solid rgba(192,192,192,0.3);
          box-shadow: 0 10px 30px rgba(192,192,192,0.08);
          color: silver;
        }
        /* Bronze */
        .hm-lb-pod-bronze {
          background: linear-gradient(160deg, rgba(205,127,50,0.07) 0%, rgba(0,0,0,0.5) 100%);
          border: 1px solid rgba(205,127,50,0.3);
          box-shadow: 0 10px 30px rgba(205,127,50,0.08);
          color: #cd7f32;
        }

        .hm-lb-pod-avatar-wrap {
          position: relative;
          margin-bottom: 0.8rem;
        }
        .hm-lb-pod-avatar {
          border-radius: 50%;
          border: 2px solid currentColor;
          box-shadow: 0 0 14px currentColor;
        }
        .hm-lb-pod-badge {
          position: absolute;
          bottom: -6px; right: -6px;
          font-size: 1.3rem;
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.4));
        }
        .hm-lb-pod-rank {
          font-size: 0.65rem;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.7;
          margin-bottom: 0.3rem;
        }
        .hm-lb-pod-addr {
          font-family: monospace;
          font-size: 0.85rem;
          color: #fff;
          margin-bottom: 0.5rem;
          opacity: 0.9;
        }
        .hm-lb-pod-pts {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: 900;
          color: #ffb800;
          text-shadow: 0 0 12px rgba(255,184,0,0.4);
        }

        /* Rows for ranks 4-5 */
        .hm-lb-rows {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          margin-bottom: 2rem;
        }
        .hm-lb-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.9rem 1.2rem;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          transition: all 0.25s ease;
        }
        .hm-lb-row:hover {
          background: rgba(0,240,255,0.04);
          border-color: rgba(0,240,255,0.18);
          transform: translateX(4px);
        }
        .hm-lb-row-rank {
          width: 32px;
          font-family: var(--font-heading);
          font-size: 1.1rem;
          font-weight: 800;
          color: rgba(255,255,255,0.4);
          text-align: center;
          flex-shrink: 0;
        }
        .hm-lb-row-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .hm-lb-row-info { flex: 1; }
        .hm-lb-row-addr {
          font-family: monospace;
          font-size: 0.9rem;
          color: #fff;
        }
        .hm-lb-row-pts {
          font-family: var(--font-heading);
          font-size: 1.05rem;
          font-weight: 800;
          color: #ffb800;
        }

        /* CTA button */
        .hm-lb-cta {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: center;
        }
        .hm-lb-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.85rem 2.2rem;
          background: linear-gradient(90deg, rgba(0,240,255,0.1), rgba(0,128,255,0.1));
          border: 1px solid rgba(0,240,255,0.3);
          border-radius: 100px;
          color: #00f0ff;
          font-family: var(--font-heading);
          font-size: 0.9rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          transition: all 0.3s ease;
          cursor: pointer;
          backdrop-filter: blur(4px);
        }
        .hm-lb-cta-btn:hover {
          background: linear-gradient(90deg, rgba(0,240,255,0.18), rgba(0,128,255,0.18));
          border-color: rgba(0,240,255,0.6);
          box-shadow: 0 0 25px rgba(0,240,255,0.25);
          color: #fff;
        }
        .hm-lb-cta-arrow {
          transition: transform 0.25s ease;
        }
        .hm-lb-cta-btn:hover .hm-lb-cta-arrow {
          transform: translateX(5px);
        }

        @media (max-width: 700px) {
          .hm-lb-section { padding: 2rem 1.2rem; }
          .hm-lb-podium { grid-template-columns: 1fr; gap: 1rem; }
          .hm-lb-toprow { flex-direction: column; align-items: flex-start; gap: 1rem; }
        }
      `}</style>

      <div
        className="home-section-container hm-lb-section"
        onClick={() => navigate('/leaderboard')}
        role="button"
        aria-label="View Full Leaderboard"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/leaderboard')}
      >
        {/* Animated background */}
        <div className="hm-lb-bg">
          <div className="hm-lb-blob hm-lb-blob-1"></div>
          <div className="hm-lb-blob hm-lb-blob-2"></div>
          <div className="hm-lb-blob hm-lb-blob-3"></div>
        </div>
        {/* Particles */}
        <div className="hm-lb-particles">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="hm-lb-particle" style={{
              left: `${(i * 8.3) + Math.random() * 5}%`,
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              animationDuration: `${4 + (i % 5) * 1.2}s`,
              animationDelay: `${i * 0.4}s`,
              bottom: 0,
            }}></div>
          ))}
        </div>

        {/* Top row */}
        <div className="hm-lb-toprow">
          <div className="hm-lb-headline">
            <span className="hm-lb-eyebrow">🏆 Hall of Fame</span>
            <h2 className="hm-lb-heading">LEADERBOARD</h2>
          </div>
          <div className="hm-lb-live-badge">
            <span className="hm-lb-live-dot"></span>
            Updated Live
          </div>
        </div>

        {/* Top-3 Podium */}
        <div className="hm-lb-podium">
          {/* Rank 2 — Silver */}
          <div className="hm-lb-pod-card hm-lb-pod-silver">
            <div className="hm-lb-pod-avatar-wrap">
              <div className="hm-lb-pod-avatar" style={{ width: 54, height: 54, background: 'hsl(200,70%,45%)' }}>
                <div className="hm-lb-pod-badge">🥈</div>
              </div>
            </div>
            <div className="hm-lb-pod-rank">Rank #2</div>
            <div className="hm-lb-pod-addr">0x9C3...8D1E</div>
            <div className="hm-lb-pod-pts">9,870 ⭐</div>
          </div>

          {/* Rank 1 — Gold (center/tallest) */}
          <div className="hm-lb-pod-card hm-lb-pod-gold">
            <div className="hm-lb-pod-avatar-wrap">
              <div className="hm-lb-pod-avatar" style={{ width: 72, height: 72, background: 'hsl(40,90%,50%)' }}>
                <div className="hm-lb-pod-badge" style={{ fontSize: '1.6rem', bottom: -8, right: -8 }}>🥇</div>
              </div>
            </div>
            <div className="hm-lb-pod-rank">Rank #1</div>
            <div className="hm-lb-pod-addr">0xA78...12F3</div>
            <div className="hm-lb-pod-pts" style={{ fontSize: '1.6rem' }}>12,450 ⭐</div>
          </div>

          {/* Rank 3 — Bronze */}
          <div className="hm-lb-pod-card hm-lb-pod-bronze">
            <div className="hm-lb-pod-avatar-wrap">
              <div className="hm-lb-pod-avatar" style={{ width: 54, height: 54, background: 'hsl(280,65%,45%)' }}>
                <div className="hm-lb-pod-badge">🥉</div>
              </div>
            </div>
            <div className="hm-lb-pod-rank">Rank #3</div>
            <div className="hm-lb-pod-addr">0xFAD...3A8B</div>
            <div className="hm-lb-pod-pts">7,850 ⭐</div>
          </div>
        </div>

        {/* Ranks 4 & 5 */}
        <div className="hm-lb-rows">
          {[
            { rank: 4, address: '0x88E...1C7D', pts: '6,420', hue: 150 },
            { rank: 5, address: '0xD2F...489A', pts: '5,210', hue: 20  },
          ].map((p) => (
            <div key={p.rank} className="hm-lb-row">
              <div className="hm-lb-row-rank">#{p.rank}</div>
              <div className="hm-lb-row-avatar" style={{ background: `hsl(${p.hue},65%,45%)` }}></div>
              <div className="hm-lb-row-info">
                <div className="hm-lb-row-addr">{p.address}</div>
              </div>
              <div className="hm-lb-row-pts">{p.pts} ⭐</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="hm-lb-cta">
          <div className="hm-lb-cta-btn">
            View Full Leaderboard <span className="hm-lb-cta-arrow">→</span>
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
