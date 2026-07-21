import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import logo from '../../assets/logo.png';

const Navbar = () => {
  const { isConnected, balance, starPoints, username, connect, isRefreshing, refreshBalance } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAnimate, setIsAnimate] = React.useState(false);

  const handlePointsClick = () => {
    setIsAnimate(true);
    setTimeout(() => setIsAnimate(false), 500);
    
    window.dispatchEvent(new CustomEvent('showToast', { 
      detail: { 
        message: `⭐ Total Balance: ${starPoints.toLocaleString()} Star Points`,
        type: 'success'
      } 
    }));
  };

  return (
    <nav className="navbar glass-panel">
      <div className="brand-logo" onClick={() => navigate('/')}>
        <img src={logo} alt="PlayFi Logo" className="logo-img" />
      </div>
      
      <div className="nav-center-tabs">
        <Link to="/vault" className={`nav-tab ${location.pathname === '/vault' ? 'active' : ''}`}>
          <span className="tab-icon">🏦</span> Vault
        </Link>
        <Link to="/" className={`nav-tab ${['/', '/mines', '/spin', '/two-doors'].includes(location.pathname) ? 'active' : ''}`}>
          <span className="tab-icon">🎮</span> Games
        </Link>
        <Link to="/leaderboard" className={`nav-tab ${location.pathname === '/leaderboard' ? 'active' : ''}`}>
          <span className="tab-icon">🏆</span> Leaderboard
        </Link>
      </div>

      <div className="nav-wallet">
        <div 
          className={`points-section points-interactive ${isAnimate ? 'points-pop' : ''}`} 
          title="Click to view balance info" 
          onClick={handlePointsClick}
        >
          <span className="star-icon" style={{ color: '#ffb800' }}>⭐</span>
          <span className="points-value" style={{ color: '#ffb800' }}>{starPoints.toLocaleString()}</span>
        </div>

        {isConnected ? (
          <div className={`wallet-pill ${isRefreshing ? 'is-refreshing' : ''}`}>
            <div className="balance-section" onClick={refreshBalance} title="Refresh Balance">
              <span id="user-balance">{balance}</span>
              <span className="currency">HBAR</span>
            </div>
            <div className="address-section">
              <span id="profile-username">{username}</span>
              <div className="connection-status"></div>
            </div>
          </div>
        ) : (
          <button 
            id="connect-btn" 
            className="btn connect-wallet-btn" 
            onClick={connect}
          >
            <span className="connect-wallet-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12V22H4V12"/>
                <path d="M22 7H2v5h20V7z"/>
                <path d="M12 22V7"/>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
              </svg>
            </span>
            <span className="connect-wallet-text">Connect Wallet</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
