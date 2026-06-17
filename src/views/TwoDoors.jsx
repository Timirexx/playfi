import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const TwoDoors = () => {
    const navigate = useNavigate();
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Vanilla JS event listener as requested
        const interceptClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Trigger the global toast notification
            window.dispatchEvent(new CustomEvent('showToast', {
                detail: { message: '🚀 Launching on Mainnet Soon!', type: 'info' }
            }));
        };

        // Use capturing phase to intercept before any children handle it
        container.addEventListener('click', interceptClick, true);

        return () => {
            container.removeEventListener('click', interceptClick, true);
        };
    }, []);

    return (
        <div className="view section-active">
            <button className="btn btn-glow" onClick={() => navigate('/')} style={{ marginBottom: '2rem' }}>&larr; Back to Hub</button>
            
            {/* The main container wrapper */}
            <div className="two-doors-wrapper" style={{ position: 'relative', marginTop: '2rem' }}>
                
                {/* The blurred and faded game card */}
                <div ref={containerRef} className="two-doors-card glass-panel" style={{ 
                    position: 'relative',
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    cursor: 'not-allowed',
                    opacity: 0.75, // Faded
                    filter: 'blur(8px)', // Blur overlay effect
                    transition: 'all 0.3s ease',
                    background: 'rgba(5, 5, 8, 0.8)'
                }}>
                    <h2 className="neon-text outline-text text-center">TWO DOORS</h2>
                    <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem' }}>
                        <div style={{ width: '120px', height: '180px', border: '3px dashed #00f0ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 240, 255, 0.1)' }}>
                            <span style={{ fontSize: '3rem' }}>🚪</span>
                        </div>
                        <div style={{ width: '120px', height: '180px', border: '3px dashed #ff003c', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 0, 60, 0.1)' }}>
                            <span style={{ fontSize: '3rem' }}>🚪</span>
                        </div>
                    </div>
                </div>

                {/* Coming Soon Badge centered directly over the blurred card */}
                <div className="coming-soon-badge" style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'linear-gradient(135deg, #ff003c, #9d00ff)',
                    color: 'white',
                    padding: '1.5rem 3rem',
                    borderRadius: '50px',
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    boxShadow: '0 0 30px rgba(255, 0, 60, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.3)',
                    border: '2px solid rgba(255, 255, 255, 0.5)',
                    pointerEvents: 'none', // Let clicks pass through to the interceptor
                    zIndex: 10,
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                    COMING SOON
                </div>

            </div>
        </div>
    );
};

export default TwoDoors;
