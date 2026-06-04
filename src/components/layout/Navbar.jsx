import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import logo from '../../assets/logo.png';

const Navbar = () => {
  const { isConnected, balance, starPoints, username, connect, isRefreshing, refreshBalance } = useWallet();
  const navigate = useNavigate();
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
      
      <div className="nav-wallet">
        <div 
          className={`points-section points-interactive ${isAnimate ? 'points-pop' : ''}`} 
          title="Click to view balance info" 
          onClick={handlePointsClick}
        >
          <span className="star-icon">⭐</span>
          <span className="points-value">{starPoints.toLocaleString()}</span>
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
            className="btn btn-primary btn-glow" 
            onClick={connect}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
