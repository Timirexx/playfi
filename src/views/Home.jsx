import React from 'react';
import { useNavigate } from 'react-router-dom';
import DailyRewardCard from '../components/ui/DailyRewardCard';

const GameCard = ({ icon, title, description, onClick, comingSoon, className }) => (
  <div className={`game-card ${comingSoon ? 'game-disabled' : ''} ${className || ''}`} onClick={!comingSoon ? onClick : undefined}>
    {comingSoon && <div className="coming-soon-badge">Coming Soon</div>}
    <div className="card-glow"></div>
    <div className="card-content">
      <div className="game-icon">{icon}</div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  </div>
);

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="view home-view section-active">
      <div className="hero-section">
        <div className="hero-header">
          <h1 className="neon-text outline-text">WELCOME TO <span className="text-blue">PLAYFI</span></h1>
          <p className="hero-subtitle">The premier professional gaming hub on the Hedera network.</p>
        </div>

        <DailyRewardCard />

        <div className="welcome-container glass-panel">
          <div className="welcome-content">
            <p className="welcome-intro">
              Experience the next generation of decentralized gaming. PlayFi combines high-stakes excitement 
              with the transparency and security of the Hedera distributed ledger.
            </p>
            
            <div className="how-it-works-grid">
              <div className="step-card">
                <div className="step-icon">1</div>
                <h5>Deposit to Vault</h5>
                <p>Transfer HBAR to your on-chain bankroll. Funds stay under your control.</p>
              </div>
              <div className="step-card">
                <div className="step-icon">2</div>
                <h5>Choose Your Game</h5>
                <p>Test your luck on Mines or Spin to Win with customizable risk levels.</p>
              </div>
              <div className="step-card">
                <div className="step-icon">3</div>
                <h5>Instant Payouts</h5>
                <p>Winnings are settled atomically back to your vault for immediate withdrawal.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;
