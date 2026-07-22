import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';

const PremiumGameCard = ({ icon, title, description, onClick, accentColor, bgGradient, badges }) => (
  <div className="pgc-card" onClick={onClick} style={{ '--pgc-accent': accentColor }}>
    <div className="pgc-bg" style={{ background: bgGradient }}></div>
    <div className="pgc-glow-orb"></div>
    <div className="pgc-shimmer"></div>
    <div className="pgc-content">
      <div className="pgc-icon-wrap">
        <div className="pgc-icon-ring"></div>
        <span className="pgc-icon">{icon}</span>
      </div>
      <h4 className="pgc-title">{title}</h4>
      <p className="pgc-desc">{description}</p>
      <div className="pgc-badges">
        {badges.map((b, i) => (
          <span key={i} className="pgc-badge">{b}</span>
        ))}
      </div>
      <button className="pgc-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <span>Play Now</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    </div>
  </div>
);

const ComingSoonCard = ({ icon, title, description, accentColor, bgGradient, badges, onPreview }) => (
  <div className="pgc-card csc-card" onClick={onPreview} style={{ '--pgc-accent': accentColor }}>
    <div className="pgc-bg" style={{ background: bgGradient }}></div>
    <div className="csc-overlay"></div>
    <div className="pgc-content">
      {/* Coming Soon badge */}
      <div className="csc-badge-wrap">
        <span className="csc-badge">🔒 Mainnet Exclusive</span>
      </div>
      <div className="pgc-icon-wrap" style={{ filter: 'grayscale(0.5) brightness(0.7)' }}>
        <div className="pgc-icon-ring"></div>
        <span className="pgc-icon">{icon}</span>
      </div>
      <h4 className="pgc-title csc-title">{title}</h4>
      <p className="pgc-desc">{description}</p>
      <div className="pgc-badges">
        {badges.map((b, i) => (
          <span key={i} className="pgc-badge csc-pill">{b}</span>
        ))}
      </div>
      <button className="pgc-btn csc-btn" onClick={(e) => { e.stopPropagation(); onPreview(); }}>
        <span>Coming Soon</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </button>
    </div>
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const { address: userAddress, updateStarPoints } = useWallet();

  const [lastClaim, setLastClaim] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [successAnim, setSuccessAnim] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

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
      <style>{`
        /* ============================================
           HOME — PREMIUM GAME CARDS
        ============================================ */
        .pgc-section-head {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .pgc-section-icon {
          font-size: 2rem;
          filter: drop-shadow(0 0 12px rgba(0,240,255,0.6));
          animation: pgc-icon-pulse 3s ease-in-out infinite;
        }
        @keyframes pgc-icon-pulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(0,240,255,0.6)); }
          50% { filter: drop-shadow(0 0 24px rgba(0,240,255,1)); }
        }
        .pgc-section-title {
          font-family: var(--font-heading);
          font-size: clamp(1.8rem, 4vw, 2.8rem);
          font-weight: 900;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin: 0;
          background: linear-gradient(90deg, #fff 30%, #00f0ff 70%, #fff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: pgc-title-shimmer 5s linear infinite;
        }
        @keyframes pgc-title-shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .pgc-section-sub {
          color: var(--text-muted);
          font-size: 1rem;
          margin: 0.4rem 0 2.5rem;
          letter-spacing: 0.5px;
        }
        .pgc-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        /* Card shell */
        .pgc-card {
          position: relative;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.07);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),
                      box-shadow 0.35s ease,
                      border-color 0.35s ease;
          min-height: 380px;
          display: flex;
          flex-direction: column;
        }
        .pgc-card:hover {
          transform: translateY(-10px) scale(1.02);
          border-color: color-mix(in srgb, var(--pgc-accent) 50%, transparent);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.5),
            0 0 40px color-mix(in srgb, var(--pgc-accent) 20%, transparent);
        }
        .pgc-card:active { transform: translateY(-4px) scale(1.01); }

        /* Unique bg gradient per card */
        .pgc-bg {
          position: absolute;
          inset: 0;
          opacity: 0.5;
          transition: opacity 0.4s ease;
        }
        .pgc-card:hover .pgc-bg { opacity: 0.75; }

        /* Glow orb that moves on hover */
        .pgc-glow-orb {
          position: absolute;
          width: 200px; height: 200px;
          border-radius: 50%;
          background: var(--pgc-accent);
          filter: blur(70px);
          opacity: 0;
          top: -50px; right: -50px;
          transition: opacity 0.4s ease, transform 0.4s ease;
          pointer-events: none;
        }
        .pgc-card:hover .pgc-glow-orb {
          opacity: 0.18;
          transform: translate(-10px, 10px);
        }

        /* Shimmer sweep */
        .pgc-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg,
            transparent 30%,
            rgba(255,255,255,0.06) 50%,
            transparent 70%);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
          pointer-events: none;
        }
        .pgc-card:hover .pgc-shimmer { transform: translateX(100%); }

        /* Content */
        .pgc-content {
          position: relative;
          z-index: 2;
          padding: 2rem 1.8rem 1.8rem;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        /* Icon */
        .pgc-icon-wrap {
          position: relative;
          width: 80px; height: 80px;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pgc-icon-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid color-mix(in srgb, var(--pgc-accent) 40%, transparent);
          background: color-mix(in srgb, var(--pgc-accent) 8%, transparent);
          transition: all 0.3s ease;
        }
        .pgc-card:hover .pgc-icon-ring {
          border-color: color-mix(in srgb, var(--pgc-accent) 70%, transparent);
          box-shadow: 0 0 20px color-mix(in srgb, var(--pgc-accent) 30%, transparent);
        }
        .pgc-icon {
          font-size: 2.5rem;
          position: relative;
          z-index: 1;
          transition: transform 0.3s ease;
          display: block;
          text-align: center;
          line-height: 80px;
        }
        .pgc-card:hover .pgc-icon { transform: scale(1.15) rotate(-5deg); }

        /* Typography */
        .pgc-title {
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #fff;
          margin: 0 0 0.6rem;
          transition: color 0.3s ease;
        }
        .pgc-card:hover .pgc-title {
          color: var(--pgc-accent);
          text-shadow: 0 0 20px color-mix(in srgb, var(--pgc-accent) 50%, transparent);
        }
        .pgc-desc {
          color: rgba(255,255,255,0.55);
          font-size: 0.9rem;
          line-height: 1.6;
          margin: 0 0 1.2rem;
        }

        /* Badges */
        .pgc-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.8rem;
          flex: 1;
          align-items: flex-start;
        }
        .pgc-badge {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          padding: 0.3rem 0.75rem;
          border-radius: 100px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
          transition: all 0.3s ease;
        }
        .pgc-card:hover .pgc-badge {
          background: color-mix(in srgb, var(--pgc-accent) 8%, transparent);
          border-color: color-mix(in srgb, var(--pgc-accent) 30%, transparent);
          color: var(--pgc-accent);
        }

        /* Button */
        .pgc-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          width: 100%;
          padding: 1rem;
          border-radius: 12px;
          border: none;
          background: linear-gradient(90deg,
            color-mix(in srgb, var(--pgc-accent) 80%, transparent),
            color-mix(in srgb, var(--pgc-accent) 60%, #0080ff));
          color: #000;
          font-family: var(--font-heading);
          font-weight: 900;
          font-size: 1rem;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px color-mix(in srgb, var(--pgc-accent) 30%, transparent);
          position: relative;
          overflow: hidden;
        }
        .pgc-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transform: skewX(-20deg);
          animation: pgc-btn-shine 3s infinite;
        }
        @keyframes pgc-btn-shine { 100% { left: 200%; } }
        .pgc-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px color-mix(in srgb, var(--pgc-accent) 50%, transparent);
          color: #fff;
        }
        .pgc-btn svg { transition: transform 0.25s ease; }
        .pgc-btn:hover svg { transform: translateX(4px); }

        @media (max-width: 900px) {
          .pgc-grid { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
        }
        @media (min-width: 600px) and (max-width: 900px) {
          .pgc-grid { grid-template-columns: repeat(2, 1fr); max-width: none; }
        }

        /* ============================================
           COMING SOON CARDS
        ============================================ */
        .csc-card {
          filter: saturate(0.4) brightness(0.75);
          transition: filter 0.35s ease,
                      transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275),
                      box-shadow 0.35s ease,
                      border-color 0.35s ease !important;
        }
        .csc-card:hover {
          filter: saturate(0.65) brightness(0.9);
          transform: translateY(-6px) scale(1.01) !important;
        }
        .csc-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 1;
          pointer-events: none;
        }
        .csc-badge-wrap {
          position: absolute;
          top: 1.2rem;
          right: 1.2rem;
          z-index: 10;
        }
        .csc-badge {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 0.3rem 0.8rem;
          border-radius: 100px;
          background: rgba(255,184,0,0.12);
          border: 1px solid rgba(255,184,0,0.35);
          color: #ffb800;
          box-shadow: 0 0 12px rgba(255,184,0,0.2);
          animation: csc-badge-pulse 3s ease-in-out infinite;
        }
        @keyframes csc-badge-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255,184,0,0.2); }
          50% { box-shadow: 0 0 22px rgba(255,184,0,0.45); }
        }
        .csc-title { color: rgba(255,255,255,0.5) !important; }
        .csc-card:hover .csc-title { color: rgba(255,255,255,0.8) !important; text-shadow: none !important; }
        .csc-pill {
          background: rgba(255,255,255,0.03) !important;
          border-color: rgba(255,255,255,0.06) !important;
          color: rgba(255,255,255,0.3) !important;
        }
        .csc-btn {
          background: rgba(255,255,255,0.06) !important;
          color: rgba(255,255,255,0.4) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          box-shadow: none !important;
          cursor: pointer;
        }
        .csc-btn::after { display: none; }
        .csc-card:hover .csc-btn {
          background: rgba(255,184,0,0.1) !important;
          border-color: rgba(255,184,0,0.3) !important;
          color: #ffb800 !important;
        }

        /* ============================================
           COMING SOON MODAL
        ============================================ */
        .csm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 9000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: csm-fade-in 0.3s ease;
        }
        @keyframes csm-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .csm-box {
          background: rgba(5, 8, 18, 0.92);
          border: 1px solid rgba(0,240,255,0.2);
          border-radius: 28px;
          padding: 3rem 2.5rem;
          max-width: 500px;
          width: 100%;
          text-align: center;
          position: relative;
          box-shadow:
            0 0 60px rgba(0,240,255,0.08),
            0 40px 80px rgba(0,0,0,0.6);
          animation: csm-scale-in 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes csm-scale-in {
          from { opacity: 0; transform: scale(0.8) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .csm-glow {
          position: absolute;
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(0,240,255,0.12) 0%, transparent 70%);
          top: -80px; left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
          border-radius: 50%;
          animation: csm-glow-pulse 4s ease-in-out infinite;
        }
        @keyframes csm-glow-pulse {
          0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
        }
        .csm-close {
          position: absolute;
          top: 1.2rem; right: 1.2rem;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50%;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: rgba(255,255,255,0.5);
          font-size: 1.2rem;
          line-height: 1;
          transition: all 0.25s ease;
        }
        .csm-close:hover {
          background: rgba(255,255,255,0.12);
          color: #fff;
          border-color: rgba(255,255,255,0.25);
        }
        .csm-rocket {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          display: block;
          filter: drop-shadow(0 0 20px rgba(0,240,255,0.6));
          animation: csm-rocket-float 3s ease-in-out infinite;
        }
        @keyframes csm-rocket-float {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        .csm-title {
          font-family: var(--font-heading);
          font-size: 1.8rem;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin: 0 0 1rem;
          background: linear-gradient(90deg, #00f0ff, #fff 55%, #00f0ff);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: pgc-title-shimmer 4s linear infinite;
        }
        .csm-msg {
          color: rgba(255,255,255,0.6);
          font-size: 0.95rem;
          line-height: 1.7;
          margin: 0 0 2rem;
        }
        .csm-games-row {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .csm-game-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1.2rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(0,240,255,0.15);
          border-radius: 100px;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.7);
          font-weight: 600;
        }
        .csm-got-it {
          background: linear-gradient(90deg, #00f0ff, #0080ff);
          border: none;
          color: #000;
          font-family: var(--font-heading);
          font-weight: 900;
          font-size: 1rem;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 1rem 3rem;
          border-radius: 100px;
          cursor: pointer;
          box-shadow: 0 0 25px rgba(0,240,255,0.4);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .csm-got-it:hover {
          box-shadow: 0 0 40px rgba(0,240,255,0.7);
          transform: translateY(-2px) scale(1.04);
          color: #fff;
        }
        @media (max-width: 500px) {
          .csm-box { padding: 2.5rem 1.5rem; }
          .csm-title { font-size: 1.4rem; }
          .csm-games-row { flex-direction: column; align-items: center; }
        }
      `}</style>

      <div className="home-section-container">
        <div className="pgc-section-head">
          <span className="pgc-section-icon">🎮</span>
          <h2 className="pgc-section-title">Play Games</h2>
        </div>
        <p className="pgc-section-sub">Choose your game, place your bet, and win on-chain</p>
        <div className="pgc-grid">
          <PremiumGameCard
            icon="💣"
            title="Mines"
            description="Navigate the minefield. Reveal safe tiles and cash out before disaster strikes."
            onClick={() => navigate('/mines')}
            accentColor="#00f0ff"
            bgGradient="linear-gradient(135deg, rgba(0,20,40,0.9) 0%, rgba(0,5,20,0.95) 100%)"
            badges={['⚡ High Risk', '💰 Up to 1000x', '🟢 Live']}
          />
          <PremiumGameCard
            icon="🎡"
            title="Spin to Win"
            description="Spin the neon wheel of fortune. Predict the multiplier and ride the momentum."
            onClick={() => navigate('/spin')}
            accentColor="#a855f7"
            bgGradient="linear-gradient(135deg, rgba(20,5,40,0.9) 0%, rgba(5,0,25,0.95) 100%)"
            badges={['🎯 Med Risk', '💰 Up to 40x', '🟢 Live']}
          />
          <PremiumGameCard
            icon="🚪"
            title="Two Doors"
            description="Two doors, one winner. Choose your fate and double your HBAR in seconds."
            onClick={() => navigate('/two-doors')}
            accentColor="#ff6b35"
            bgGradient="linear-gradient(135deg, rgba(30,8,0,0.9) 0%, rgba(15,3,0,0.95) 100%)"
            badges={['🎲 50/50 Odds', '💰 2x Payout', '🟢 Live']}
          />
          <ComingSoonCard
            icon="🪙"
            title="Coin Flip"
            description="The purest 50/50 gamble on Hedera. Heads or tails, double or nothing — fast and fair."
            accentColor="#ffb800"
            bgGradient="linear-gradient(135deg, rgba(30,20,0,0.95) 0%, rgba(15,10,0,0.98) 100%)"
            badges={['🎲 50/50 Odds', '💰 2x Payout', '🔒 Mainnet']}
            onPreview={() => setShowComingSoonModal(true)}
          />
          <ComingSoonCard
            icon="🔴"
            title="Red or Blue"
            description="Choose your color and bet on the outcome. Simple rules, electrifying results."
            accentColor="#ef4444"
            bgGradient="linear-gradient(135deg, rgba(25,0,5,0.95) 0%, rgba(10,0,3,0.98) 100%)"
            badges={['⚡ High Energy', '💰 2x Payout', '🔒 Mainnet']}
            onPreview={() => setShowComingSoonModal(true)}
          />
        </div>
      </div>

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="csm-backdrop" onClick={() => setShowComingSoonModal(false)}>
          <div className="csm-box" onClick={(e) => e.stopPropagation()}>
            <div className="csm-glow"></div>
            <button className="csm-close" onClick={() => setShowComingSoonModal(false)} aria-label="Close">✕</button>
            <span className="csm-rocket">🚀</span>
            <h3 className="csm-title">Launching on Mainnet</h3>
            <p className="csm-msg">
              <strong style={{ color: '#fff' }}>Coin Flip</strong> and <strong style={{ color: '#fff' }}>Red or Blue</strong> will be available when PlayFi launches on Mainnet.
              Stay tuned for exciting rewards and new gameplay!
            </p>
            <div className="csm-games-row">
              <div className="csm-game-pill">🪙 Coin Flip</div>
              <div className="csm-game-pill">🔴 Red or Blue</div>
            </div>
            <button className="csm-got-it" onClick={() => setShowComingSoonModal(false)}>Got It!</button>
          </div>
        </div>
      )}

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

      {/* Premium Footer */}
      <style>{`
        /* ============================================
           PREMIUM FOOTER
        ============================================ */
        .hm-footer {
          position: relative;
          background: linear-gradient(180deg, rgba(0, 10, 20, 0) 0%, rgba(0, 15, 30, 0.95) 100%);
          border-top: 1px solid rgba(0, 240, 255, 0.1);
          padding: 5rem 2rem 2rem;
          margin-top: 6rem;
          overflow: hidden;
        }
        .hm-footer-glow {
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 60%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,240,255,0.5), transparent);
          box-shadow: 0 0 30px rgba(0,240,255,0.8);
        }
        .hm-footer-content {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 3rem;
          position: relative;
          z-index: 2;
        }
        .hm-footer-brand h3 {
          font-family: var(--font-heading);
          font-size: 2rem;
          font-weight: 900;
          letter-spacing: 2px;
          color: #fff;
          margin: 0 0 1rem;
          text-shadow: 0 0 15px rgba(0,240,255,0.4);
        }
        .hm-footer-brand p {
          color: rgba(255,255,255,0.6);
          font-size: 0.95rem;
          line-height: 1.6;
          margin-bottom: 2rem;
          max-width: 300px;
        }
        .hm-footer-socials {
          display: flex;
          gap: 1rem;
        }
        .hm-footer-social-icon {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          color: rgba(255,255,255,0.7);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .hm-footer-social-icon:hover {
          background: rgba(0,240,255,0.1);
          border-color: rgba(0,240,255,0.5);
          color: #00f0ff;
          transform: translateY(-3px);
          box-shadow: 0 5px 15px rgba(0,240,255,0.2);
        }
        .hm-footer-col h4 {
          font-family: var(--font-heading);
          font-size: 1.1rem;
          color: #fff;
          margin: 0 0 1.5rem;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .hm-footer-links {
          list-style: none;
          padding: 0; margin: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .hm-footer-links li a {
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-size: 0.95rem;
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .hm-footer-links li a:hover {
          color: #00f0ff;
          transform: translateX(4px);
        }
        .hm-footer-bottom {
          max-width: 1200px;
          margin: 4rem auto 0;
          padding-top: 2rem;
          border-top: 1px solid rgba(255,255,255,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 2;
        }
        .hm-footer-copy {
          color: rgba(255,255,255,0.5);
          font-size: 0.85rem;
        }
        .hm-footer-badges {
          display: flex;
          gap: 1rem;
        }
        .hm-footer-badge {
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255,255,255,0.6);
          padding: 0.4rem 0.8rem;
          background: rgba(255,255,255,0.03);
          border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.08);
          letter-spacing: 0.5px;
        }
        .hm-footer-btt {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: rgba(0,240,255,0.1);
          border: 1px solid rgba(0,240,255,0.3);
          color: #00f0ff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .hm-footer-btt:hover {
          background: rgba(0,240,255,0.2);
          box-shadow: 0 0 20px rgba(0,240,255,0.4);
          transform: translateY(-3px);
          color: #fff;
        }
        
        @media (max-width: 900px) {
          .hm-footer-content {
            grid-template-columns: 1fr 1fr;
          }
          .hm-footer-brand {
            grid-column: 1 / -1;
            text-align: center;
          }
          .hm-footer-brand p {
            margin: 0 auto 2rem;
          }
          .hm-footer-socials {
            justify-content: center;
          }
        }
        @media (max-width: 600px) {
          .hm-footer-content {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .hm-footer-bottom {
            flex-direction: column;
            gap: 1.5rem;
            text-align: center;
          }
          .hm-footer-links li a {
            justify-content: center;
          }
        }
      `}</style>
      
      <footer className="hm-footer">
        <div className="hm-footer-glow"></div>
        <div className="hm-footer-content">
          <div className="hm-footer-brand">
            <h3>PLAYFI</h3>
            <p>The Next Generation of Decentralized Gaming. Play, stake, and earn on the Hedera network with total transparency.</p>
            <div className="hm-footer-socials">
              <span className="hm-footer-social-icon">𝕏</span>
              <span className="hm-footer-social-icon">👾</span>
              <span className="hm-footer-social-icon">✈️</span>
              <span className="hm-footer-social-icon">🐙</span>
            </div>
          </div>
          
          <div className="hm-footer-col">
            <h4>Platform</h4>
            <ul className="hm-footer-links">
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({top:0, behavior:'smooth'}); }}>Games</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/vault'); }}>Vault</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/leaderboard'); }}>Leaderboard</a></li>
            </ul>
          </div>
          
          <div className="hm-footer-col">
            <h4>Resources</h4>
            <ul className="hm-footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>Documentation</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Whitepaper</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>FAQ</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Support</a></li>
            </ul>
          </div>
          
          <div className="hm-footer-col">
            <h4>Community</h4>
            <ul className="hm-footer-links">
              <li><a href="#" onClick={(e) => e.preventDefault()}>Discord</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>X (Twitter)</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Telegram</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}>Announcements</a></li>
            </ul>
          </div>
        </div>
        
        <div className="hm-footer-bottom">
          <div className="hm-footer-copy">
            © 2025 PlayFi. All rights reserved.
          </div>
          <div className="hm-footer-badges">
            <span className="hm-footer-badge">Powered by Hedera ⓗ</span>
            <span className="hm-footer-badge">Provably Fair Gaming</span>
          </div>
          <button 
            className="hm-footer-btt" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to Top"
          >
            ↑
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Home;
