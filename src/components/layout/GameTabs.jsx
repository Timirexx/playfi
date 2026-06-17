import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const GameTabs = () => {
  const location = useLocation();
  
  // Don't show tabs on home page if you prefer, but usually good for navigation
  // if (location.pathname === '/') return null;

  return (
    <div className="game-tabs-container">
      <div className="game-tabs glass-panel">
        <NavLink 
          to="/vault" 
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
        >
          <span className="tab-icon">🏦</span>
          <span className="tab-text">Vault</span>
        </NavLink>
        
        <NavLink 
          to="/mines" 
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
        >
          <span className="tab-icon">💣</span>
          <span className="tab-text">Mines</span>
        </NavLink>
        
        <NavLink 
          to="/spin" 
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
        >
          <span className="tab-icon">🎡</span>
          <span className="tab-text">Spin</span>
        </NavLink>

        <NavLink 
          to="/two-doors" 
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
        >
          <span className="tab-icon">🚪</span>
          <span className="tab-text">Two Doors</span>
        </NavLink>

        <NavLink 
          to="/leaderboard" 
          className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
        >
          <span className="tab-icon">🏆</span>
          <span className="tab-text">Leaderboard</span>
        </NavLink>
      </div>
    </div>
  );
};

export default GameTabs;
