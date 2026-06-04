import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';

const Leaderboard = () => {
    const { isConnected, address, starPoints } = useWallet();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    const API_BASE = window.location.hostname === 'localhost' ? "http://localhost:3001" : "https://playfi-backend.vercel.app";

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/leaderboard`);
                const data = await response.json();
                if (data.success) {
                    setPlayers(data.leaderboard);
                }
            } catch (error) {
                console.error("Failed to fetch leaderboard:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [API_BASE]);

    // Split top 5 and the rest
    const top5 = players.slice(0, 5);
    const others = players.slice(5);

    return (
        <div className="view section-active">
            <div className="hero-section">
                <div className="hero-header">
                    <h2 className="neon-text outline-text text-center" style={{ width: '100%' }}>HALL OF FAME</h2>
                    <p className="hero-subtitle">The legendary star hunters of PlayFi.</p>
                </div>

                {/* TOP 5 LEGENDS SECTION */}
                <div className="top-legends-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                    gap: '1.5rem', 
                    marginBottom: '3rem' 
                }}>
                    {top5.map((player, index) => (
                        <div key={player.address} className="glass-panel legend-card" style={{
                            padding: '2rem 1.5rem',
                            textAlign: 'center',
                            position: 'relative',
                            border: index === 0 ? '2px solid gold' : index === 1 ? '2px solid silver' : index === 2 ? '2px solid #cd7f32' : '1px solid rgba(255,255,255,0.1)',
                            transform: index === 0 ? 'scale(1.05)' : 'scale(1)',
                            zIndex: index === 0 ? 2 : 1,
                            background: index === 0 ? 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(0,0,0,0.5) 100%)' : 'rgba(0,0,0,0.3)'
                        }}>
                            <div className={`medal medal-${index + 1}`} style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '✨'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                {player.address === address ? 'YOU' : `RANK #${index + 1}`}
                            </div>
                            <div className="neon-text" style={{ fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '1rem' }}>
                                {player.address.slice(0, 6)}...{player.address.slice(-4)}
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffea00' }}>
                                {player.stars.toLocaleString()} ⭐
                            </div>
                        </div>
                    ))}
                    {loading && top5.length === 0 && <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', gridColumn: '1 / -1' }}>Loading Legends...</div>}
                </div>

                <div className="leaderboard-container glass-panel">
                    <div className="leaderboard-header">
                        <h3 style={{ color: 'var(--primary-color)' }}>Global Rankings</h3>
                        {isConnected && (
                            <div className="your-rank-summary">
                                <span className="label">Your Stars:</span>
                                <span className="value" style={{ color: '#ffea00' }}>{starPoints.toLocaleString()} ⭐</span>
                            </div>
                        )}
                    </div>

                    <div className="table-responsive">
                        <table className="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Player</th>
                                    <th className="text-right">Total Stars</th>
                                    <th className="text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {players.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="4" className="text-center" style={{ padding: '3rem' }}>No star hunters found yet. Be the first!</td>
                                    </tr>
                                )}
                                {players.map((player, index) => (
                                    <tr key={player.address} className={player.address === address ? 'current-user-row' : ''}>
                                        <td className="rank-cell">#{index + 1}</td>
                                        <td className="user-cell">
                                            <div className="user-info">
                                                <div className="avatar-placeholder" style={{ background: `hsl(${index * 40}, 70%, 50%)` }}></div>
                                                <span>{player.address.slice(0, 10)}...{player.address.slice(-6)}</span>
                                            </div>
                                        </td>
                                        <td className="text-right" style={{ color: '#ffea00', fontWeight: 'bold' }}>
                                            {player.stars.toLocaleString()} ⭐
                                        </td>
                                        <td className="text-right">
                                            <span style={{ 
                                                padding: '4px 10px', 
                                                borderRadius: '20px', 
                                                fontSize: '0.7rem',
                                                background: 'rgba(0, 255, 136, 0.1)',
                                                color: '#00ff88',
                                                border: '1px solid rgba(0, 255, 136, 0.3)'
                                            }}>ACTIVE</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
