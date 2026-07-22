import React from 'react';
import { useNavigate } from 'react-router-dom';

const Footer = () => {
  const navigate = useNavigate();

  return (
    <>
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
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/hub'); window.scrollTo(0,0); }}>Home</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/hub'); }}>Games</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/vault'); window.scrollTo(0,0); }}>Vault</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/leaderboard'); window.scrollTo(0,0); }}>Leaderboard</a></li>
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
    </>
  );
};

export default Footer;
