import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

/**
 * Expert React SpinWheel Component
 * Integrates with Hedera backend and uses Framer Motion for premium animations.
 */
const SpinWheel = ({ betAmount, prediction, onSpinStart, onSpinEnd }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [currentRotation, setCurrentRotation] = useState(0);
    const canvasRef = useRef(null);
    const controls = useAnimation();

    // 36-slice layout from top (clockwise)
    const WHEEL_LAYOUT = [
        '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', '1x', '2x', '1x', '4x', 
        '1x', '2x', '1x', '10x', '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', 
        '1x', '2x', '1x', '4x', '1x', '2x', '1x', '20x', '1x', '2x', '1x', '40x'
    ];

    const COLORS = {
        '1x': '#00f0ff',
        '2x': '#ffea00',
        '4x': '#ff3366',
        '5x': '#00e676',
        '10x': '#f7b733',
        '20x': '#9d50bb',
        '40x': '#ffffff'
    };

    // Draw the wheel once on mount
    useEffect(() => {
        drawWheel();
    }, []);

    const drawWheel = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = cx - 10;
        const sliceAngle = (2 * Math.PI) / 36;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2); // Start at 12 o'clock
        ctx.translate(-cx, -cy);

        for (let i = 0; i < 36; i++) {
            const mult = WHEEL_LAYOUT[i];
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            // Slice
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.fillStyle = COLORS[mult] || '#333';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#050508';
            ctx.stroke();

            // Text (selective to avoid clutter)
            if (['10x', '20x', '40x', '5x', '4x'].includes(mult) || i % 2 === 0) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(startAngle + sliceAngle / 2);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#050508';
                ctx.font = 'bold 12px Outfit';
                ctx.fillText(mult, radius - 15, 4);
                ctx.restore();
            }
        }
        ctx.restore();

        // Center hub
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, 2 * Math.PI);
        ctx.fillStyle = '#050508';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.stroke();
    };

    const startSpin = async () => {
        if (isSpinning) return;
        
        // 1. Initial UI update
        setIsSpinning(true);
        if (onSpinStart) onSpinStart();

        try {
            // 2. Call Parent to handle Hedera Payment and Backend API
            // The parent should return the targetIndex from /api/spin
            const result = await onSpinStart(); 
            if (!result || result.targetIndex === undefined) {
                setIsSpinning(false);
                return;
            }

            const { targetIndex } = result;

            // 3. MATH & LOGIC
            const targetDegree = 360 - (targetIndex * 10);
            const extraSpins = 360 * 8; // 8 full spins for suspense
            const finalRotation = currentRotation + extraSpins + targetDegree;

            // 4. TRIGGER FRAMER MOTION ANIMATION
            await controls.start({
                rotate: finalRotation,
                transition: {
                    duration: 6, // 6 seconds for that high-stakes feel
                    ease: [0.15, 0, 0.15, 1] // Custom ease-out cubic-bezier for a slow "tick" stop
                }
            });

            // 5. POST-ANIMATION
            setCurrentRotation(finalRotation);
            setIsSpinning(false);
            if (onSpinEnd) onSpinEnd(result);

        } catch (error) {
            console.error("Spin failed:", error);
            setIsSpinning(false);
        }
    };

    return (
        <div style={{ position: 'relative', width: '300px', margin: '0 auto' }}>
            {/* The Pointer */}
            <div style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '15px solid transparent',
                borderRight: '15px solid transparent',
                borderTop: '30px solid #00f0ff',
                zIndex: 10,
                filter: 'drop-shadow(0 0 5px rgba(0, 240, 255, 0.5))'
            }} />

            {/* The Animating Canvas */}
            <motion.canvas
                ref={canvasRef}
                width={300}
                height={300}
                animate={controls}
                initial={{ rotate: 0 }}
                style={{
                    borderRadius: '50%',
                    boxShadow: '0 0 40px rgba(0, 240, 255, 0.15)',
                    display: 'block'
                }}
            />

            {/* Spin Button */}
            <button
                onClick={startSpin}
                disabled={isSpinning}
                style={{
                    marginTop: '2rem',
                    width: '100%',
                    padding: '1rem',
                    background: isSpinning ? '#1a1b23' : '#00f0ff',
                    color: isSpinning ? '#8892b0' : '#050508',
                    border: 'none',
                    borderRadius: '8px',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 900,
                    fontSize: '1.2rem',
                    cursor: isSpinning ? 'not-allowed' : 'pointer',
                    boxShadow: isSpinning ? 'none' : '0 0 20px rgba(0, 240, 255, 0.3)',
                    transition: 'all 0.3s ease'
                }}
            >
                {isSpinning ? 'SPINNING...' : 'SPIN WHEEL'}
            </button>
        </div>
    );
};

export default SpinWheel;
