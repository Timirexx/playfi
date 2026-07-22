import React from 'react';
import { useNavigate } from 'react-router-dom';

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
        <h2 className="home-section-title uppercase">Leaderboard</h2>
        <div className="home-leaderboard-header">
          <p className="home-leaderboard-subtitle">Top players on PlayFi</p>
          <div className="home-leaderboard-live">
            Updated Live <span className="live-indicator"></span>
          </div>
        </div>

        <div className="glass-panel home-leaderboard-panel">
          <div className="home-leaderboard-tabs">
            <div className="leaderboard-tab-item active">All Players</div>
            <div className="leaderboard-tab-item hover-white">Vault Leaderboard</div>
            <div className="leaderboard-tab-item hover-white">Games Leaderboard</div>
          </div>
          
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
