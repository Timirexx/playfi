import React from 'react';
import { useNavigate } from 'react-router-dom';

const GameCard = ({ icon, title, description, onClick }) => (
  <div className="home-game-card glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div className="home-game-icon" style={{ 
        width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.1)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem',
        border: '1px solid rgba(0, 240, 255, 0.3)', boxShadow: '0 0 15px rgba(0, 240, 255, 0.2)'
      }}>
        {icon}
      </div>
      <div>
        <h4 style={{ margin: 0, color: '#ffb800', fontSize: '1.2rem', fontFamily: 'Outfit, sans-serif' }}>{title}</h4>
        <p style={{ margin: '0.2rem 0 0 0', color: '#8892b0', fontSize: '0.85rem' }}>{description}</p>
      </div>
    </div>
    <button className="btn btn-hero btn-glow" onClick={onClick} style={{ marginTop: 'auto', padding: '0.8rem', borderRadius: '6px' }}>
      Play Now
    </button>
  </div>
);

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="view home-view section-active">
      
      {/* Hero Section */}
      <div className="hero-dashboard glass-panel" style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '3rem 4rem', borderRadius: '16px', marginBottom: '3rem',
        background: 'linear-gradient(90deg, rgba(5,5,8,1) 0%, rgba(0,240,255,0.05) 100%)',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '600px', zIndex: 2 }}>
          <p style={{ color: '#00f0ff', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.9rem', marginBottom: '1rem' }}>WELCOME TO PLAYFI</p>
          <h1 style={{ fontSize: '3.5rem', lineHeight: 1.1, marginBottom: '1.5rem', fontFamily: 'Outfit, sans-serif' }}>
            The Next Generation<br />
            of <span className="text-blue">Decentralized Gaming</span>
          </h1>
          <p style={{ color: '#8892b0', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Play high-stakes games, earn rewards, and compete on the<br />
            Hedera network with full transparency.
          </p>
        </div>
        <div style={{ position: 'absolute', right: '-5%', top: '50%', transform: 'translateY(-50%)', zIndex: 1, opacity: 0.8 }}>
           {/* Abstract graphics to simulate the 3D controller/coins */}
           <div style={{ 
             width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,240,255,0.15) 0%, transparent 70%)',
             display: 'flex', justifyContent: 'center', alignItems: 'center'
           }}>
             <div style={{ fontSize: '10rem', filter: 'drop-shadow(0 0 20px rgba(0, 240, 255, 0.5))' }}>🎮</div>
             <div style={{ position: 'absolute', right: '50px', bottom: '100px', fontSize: '5rem', filter: 'drop-shadow(0 0 10px rgba(0,240,255,0.8))' }}>🪙</div>
           </div>
        </div>
      </div>

      {/* Play Games Section */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem', fontFamily: 'Outfit, sans-serif' }}>PLAY <span style={{ color: '#00f0ff' }}>GAMES</span></h2>
        <p style={{ color: '#8892b0', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Choose your game and start playing</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
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
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase' }}>Vault</h2>
        <p style={{ color: '#8892b0', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Stake your HBAR and earn Play Points</p>
        
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ 
              width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.1)', 
              display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.8rem',
              border: '1px solid rgba(0, 240, 255, 0.3)'
            }}>
              🏦
            </div>
            <div>
              <h4 style={{ margin: 0, color: '#ffb800', fontSize: '1.3rem', fontFamily: 'Outfit, sans-serif' }}>Staking Vault</h4>
              <p style={{ margin: '0.2rem 0 0 0', color: '#8892b0', fontSize: '0.9rem' }}>Stake HBAR, earn Play Points, <br/>and climb the leaderboard.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '4rem', textAlign: 'left' }}>
            <div>
              <div style={{ color: '#8892b0', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Total Staked</div>
              <div style={{ color: '#ffb800', fontSize: '1.3rem', fontWeight: 'bold' }}>1,250 HBAR</div>
            </div>
            <div>
              <div style={{ color: '#8892b0', fontSize: '0.9rem', marginBottom: '0.3rem' }}>APY</div>
              <div style={{ color: '#ffb800', fontSize: '1.3rem', fontWeight: 'bold' }}>12.5%</div>
            </div>
            <div>
              <div style={{ color: '#8892b0', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Your Points</div>
              <div style={{ color: '#ffb800', fontSize: '1.3rem', fontWeight: 'bold' }}>720 PTS</div>
            </div>
          </div>

          <button className="btn btn-hero btn-glow" onClick={() => navigate('/vault')} style={{ width: 'auto', padding: '1rem 3rem', borderRadius: '6px', margin: 0 }}>
            Stake Now
          </button>
        </div>
      </div>

      {/* Leaderboard Section */}
      <div style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem', fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase' }}>Leaderboard</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <p style={{ color: '#8892b0', fontSize: '0.9rem', margin: 0 }}>Top players on PlayFi</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#8892b0' }}>
            Updated Live <span style={{ width: '8px', height: '8px', background: '#00f0ff', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #00f0ff' }}></span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 1rem' }}>
            <div style={{ padding: '1rem 1.5rem', color: '#00f0ff', borderBottom: '2px solid #00f0ff', cursor: 'pointer', fontWeight: 'bold' }}>All Players</div>
            <div style={{ padding: '1rem 1.5rem', color: '#8892b0', cursor: 'pointer', transition: '0.3s' }} className="hover-white">Vault Leaderboard</div>
            <div style={{ padding: '1rem 1.5rem', color: '#8892b0', cursor: 'pointer', transition: '0.3s' }} className="hover-white">Games Leaderboard</div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem 2rem' }}>
            {/* Mock Leaderboard Items based on reference */}
            {[
              { rank: 1, address: '0xA78...12F3', pts: '12,450', isCrown: true },
              { rank: 2, address: '0x9C3...8D1E', pts: '9,870' },
              { rank: 3, address: '0xFAD...3A8B', pts: '7,850', isCrown: true },
              { rank: 4, address: '0x88E...1C7D', pts: '6,420' },
              { rank: 5, address: '0xD2F...489A', pts: '5,210' }
            ].map((player, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: player.rank <= 3 ? '#ffb800' : '#8892b0' }}>{player.rank}</div>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1a1b26', border: player.rank <= 3 ? '2px solid #ffb800' : '1px solid #333' }}></div>
                <div>
                  <div style={{ fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {player.isCrown && <span style={{ color: '#ffb800' }}>👑</span>} {player.address}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#8892b0' }}>{player.pts} PTS</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '2rem 0', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#8892b0', fontSize: '0.85rem'
      }}>
        <div>Built on Hedera ⓗ</div>
        <div>PlayFi © 2025. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '1.2rem' }}>
          <span style={{ cursor: 'pointer' }} className="hover-white">🐦</span>
          <span style={{ cursor: 'pointer' }} className="hover-white">💬</span>
          <span style={{ cursor: 'pointer' }} className="hover-white">✈️</span>
        </div>
      </footer>

      <style jsx="true">{`
        .hover-white:hover { color: white !important; }
        .home-game-card { transition: all 0.3s ease; }
        .home-game-card:hover { transform: translateY(-5px); border-color: #00f0ff; box-shadow: 0 5px 25px rgba(0,240,255,0.15); }
      `}</style>
    </div>
  );
};

export default Home;
