import React from 'react';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="landing-page view section-active">
            <style>{`
                .landing-page {
                    min-height: calc(100vh - 120px);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 2rem;
                    text-align: center;
                    position: relative;
                }

                .landing-hero {
                    max-width: 900px;
                    z-index: 2;
                    margin-bottom: 4rem;
                }

                .landing-title {
                    font-family: var(--font-heading);
                    font-size: clamp(3rem, 8vw, 5rem);
                    font-weight: 900;
                    line-height: 1.1;
                    margin-bottom: 1.5rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    background: linear-gradient(135deg, #fff 0%, var(--neon-blue) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    filter: drop-shadow(0 0 20px rgba(0, 240, 255, 0.3));
                }

                .landing-desc {
                    font-size: 1.2rem;
                    color: var(--text-muted);
                    line-height: 1.6;
                    margin-bottom: 2.5rem;
                    max-width: 700px;
                    margin-left: auto;
                    margin-right: auto;
                }

                .landing-desc strong {
                    color: var(--text-main);
                    text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
                }

                .btn-start {
                    font-size: 1.3rem;
                    padding: 1.2rem 3rem;
                    border-radius: 50px;
                    background: var(--neon-blue);
                    color: #000;
                    font-family: var(--font-heading);
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 0 30px rgba(0, 240, 255, 0.5);
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative;
                    overflow: hidden;
                }

                .btn-start:hover {
                    transform: translateY(-4px) scale(1.05);
                    box-shadow: 0 0 50px rgba(0, 240, 255, 0.8);
                }

                .btn-start::before {
                    content: '';
                    position: absolute;
                    top: 0; left: -100%;
                    width: 50%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
                    transform: skewX(-20deg);
                    transition: left 0s;
                }

                .btn-start:hover::before {
                    left: 150%;
                    transition: left 0.6s ease;
                }

                .landing-features {
                    display: flex;
                    gap: 2rem;
                    flex-wrap: wrap;
                    justify-content: center;
                    width: 100%;
                    max-width: 1200px;
                    z-index: 2;
                }

                .feature-card {
                    background: rgba(10, 15, 25, 0.6);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(0, 240, 255, 0.1);
                    border-radius: 20px;
                    padding: 2rem;
                    flex: 1;
                    min-width: 250px;
                    max-width: 350px;
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .feature-card:hover {
                    transform: translateY(-10px);
                    border-color: rgba(0, 240, 255, 0.4);
                    background: rgba(10, 15, 25, 0.8);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 240, 255, 0.15);
                }

                .feature-icon {
                    font-size: 3.5rem;
                    margin-bottom: 1rem;
                    filter: drop-shadow(0 0 15px rgba(0, 240, 255, 0.4));
                }

                .feature-title {
                    font-family: var(--font-heading);
                    color: var(--neon-blue);
                    font-size: 1.4rem;
                    font-weight: 700;
                    margin-bottom: 0.8rem;
                }

                .feature-desc {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    line-height: 1.5;
                }

                /* Vault Wide Card */
                .feature-card-wide {
                    background: rgba(10, 15, 25, 0.6);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 184, 0, 0.3);
                    border-radius: 20px;
                    padding: 3rem 2rem;
                    width: 100%;
                    max-width: 1200px;
                    margin-bottom: 2rem;
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 2rem;
                    text-align: left;
                    z-index: 2;
                    cursor: pointer;
                }

                .feature-card-wide:hover {
                    transform: translateY(-5px);
                    border-color: rgba(255, 184, 0, 0.6);
                    background: rgba(10, 15, 25, 0.8);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 184, 0, 0.15);
                }

                .wide-icon {
                    font-size: 5rem;
                    filter: drop-shadow(0 0 20px rgba(255, 184, 0, 0.4));
                    flex-shrink: 0;
                }

                .wide-content {
                    flex-grow: 1;
                }
                
                .wide-title {
                    font-family: var(--font-heading);
                    color: #ffb800;
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: 1rem;
                }
                
                @media (max-width: 768px) {
                    .feature-card-wide {
                        flex-direction: column;
                        text-align: center;
                    }
                }

                /* Floating background elements */
                .ambient-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    z-index: 0;
                    opacity: 0.4;
                    animation: float 10s ease-in-out infinite alternate;
                }

                .orb-1 {
                    width: 400px;
                    height: 400px;
                    background: rgba(0, 240, 255, 0.2);
                    top: 10%;
                    left: -100px;
                }

                .orb-2 {
                    width: 300px;
                    height: 300px;
                    background: rgba(255, 51, 102, 0.15);
                    bottom: 10%;
                    right: -50px;
                    animation-delay: -5s;
                }

                @keyframes float {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(30px, -50px) scale(1.1); }
                }

            `}</style>
            
            <div className="ambient-orb orb-1"></div>
            <div className="ambient-orb orb-2"></div>

            <div className="landing-hero">
                <h1 className="landing-title">The Future of Web3 Gaming</h1>
                <p className="landing-desc">
                    Welcome to <strong>PlayFi</strong>, the ultimate decentralized gaming platform. 
                    Play provably fair games, stake your HBAR for passive rewards, and compete on our global leaderboard. 
                    Experience true ownership and instant payouts.
                </p>
                <button className="btn-start" onClick={() => navigate('/hub')}>
                    Get Started
                </button>
            </div>

            <div className="feature-card-wide" onClick={() => navigate('/vault')}>
                <div className="wide-content">
                    <div className="wide-title">The PlayFi Vault</div>
                    <div className="feature-desc" style={{ fontSize: '1.1rem', maxWidth: '800px' }}>
                        Stake your HBAR securely in the Vault to start earning Play Points. 
                        Receive exclusive rewards, climb the leaderboard, and unlock premium platform features. 
                        The more you stake, the more you earn.
                    </div>
                </div>
                <div className="wide-icon">🏦</div>
            </div>

            <div className="landing-features">
                <div className="feature-card">
                    <div className="feature-icon">💣</div>
                    <div className="feature-title">Mines</div>
                    <div className="feature-desc">
                        Navigate the grid carefully. Find the stars to multiply your wager, but hit a mine and lose it all.
                    </div>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">🎡</div>
                    <div className="feature-title">Spin to Win</div>
                    <div className="feature-desc">
                        Predict the multiplier and spin the fortune wheel. High risk meets massive rewards.
                    </div>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">🚪</div>
                    <div className="feature-title">Two Doors</div>
                    <div className="feature-desc">
                        A true 50/50 game of chance. Pick the right door to double your stake instantly.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Landing;
