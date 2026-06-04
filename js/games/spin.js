const wheelGame = {
    state: {
        isRunning: false,
        betAmount: 0,
        currentRotation: 0,
        lastResult: null,
        // Visual Wheel Layout (36 slices)
        layout: [
            '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', '1x', '2x', '1x', '4x', 
            '1x', '2x', '1x', '10x', '1x', '2x', '1x', '4x', '1x', '2x', '1x', '5x', 
            '1x', '2x', '1x', '4x', '1x', '2x', '1x', '20x', '1x', '2x', '1x', '40x'
        ],
        colors: {
            '1x': '#00f0ff',
            '2x': '#ffea00',
            '4x': '#ff3366',
            '5x': '#00e676',
            '10x': '#f7b733',
            '20x': '#9d50bb',
            '40x': '#ffffff'
        }
    },

    el: {
        canvas: null,
        ctx: null,
        btn: null,
        betInput: null,
        predictionInput: null,
        resultDisplay: null
    },

    init() {
        this.el.canvas = document.getElementById('wheel-canvas');
        if (!this.el.canvas) return;

        this.el.ctx = this.el.canvas.getContext('2d');
        this.el.btn = document.getElementById('wheel-action-btn');
        this.el.betInput = document.getElementById('wheel-bet');
        this.el.predictionInput = document.getElementById('wheel-prediction');
        this.el.resultDisplay = document.getElementById('wheel-result');
        
        this.drawWheel();
    },

    drawWheel() {
        if (!this.el.ctx) return;
        const ctx = this.el.ctx;
        const width = this.el.canvas.width;
        const height = this.el.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = cx - 10;
        const sliceAngle = (2 * Math.PI) / this.state.layout.length;

        ctx.clearRect(0, 0, width, height);
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2); // Start at 12 o'clock
        ctx.translate(-cx, -cy);

        for (let i = 0; i < this.state.layout.length; i++) {
            const mult = this.state.layout[i];
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.fillStyle = this.state.colors[mult] || '#333';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#050508';
            ctx.stroke();

            // Text
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
    },

    async spin() {
        if (!app.state.isConnected || this.state.isRunning) return;

        const amount = parseFloat(this.el.betInput.value);
        const prediction = this.el.predictionInput.value;

        if (isNaN(amount) || amount !== 1) {
            app.showToast('Currently only 1 HBAR spins are supported', 'error');
            return;
        }

        this.el.btn.disabled = true;
        
        // 1. DEDUCT BET (ON-CHAIN)
        const txHash = await app.processBet(amount);
        if (!txHash) {
            this.el.btn.disabled = false;
            return;
        }

        this.state.betAmount = amount;
        this.state.isRunning = true;
        this.el.betInput.disabled = true;
        this.el.predictionInput.disabled = true;
        this.el.resultDisplay.classList.add('hidden');

        try {
            // 2. CALL BACKEND FOR RESULT
            const response = await fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionId: txHash,
                    userAddress: app.state.walletAddress,
                    prediction: prediction
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Server error');
            }

            this.state.lastResult = result;
            const winningIndex = result.targetIndex;
            
            // 3. ANIMATE
            const numSlices = this.state.layout.length;
            const sliceAngleDeg = 360 / numSlices;
            const extraSpins = 8; 
            
            const sliceCenter = (winningIndex * sliceAngleDeg) + (sliceAngleDeg / 2);
            const currentNormalized = this.state.currentRotation % 360;
            let rotationNeeded = (270 - sliceCenter - currentNormalized) % 360;
            if (rotationNeeded <= 0) rotationNeeded += 360;
            
            this.state.currentRotation += (extraSpins * 360) + rotationNeeded;

            this.el.canvas.style.transition = 'transform 4s cubic-bezier(0.15, 0, 0.15, 1)';
            this.el.canvas.style.transform = `rotate(${this.state.currentRotation}deg)`;

            setTimeout(() => {
                this.endSpin();
            }, 4100);

        } catch (err) {
            console.error('Spin API Error:', err);
            app.showToast(err.message, 'error');
            this.state.isRunning = false;
            this.el.btn.disabled = false;
            this.el.betInput.disabled = false;
            this.el.predictionInput.disabled = false;
        }
    },

    endSpin() {
        this.state.isRunning = false;
        this.el.btn.disabled = false;
        this.el.betInput.disabled = false;
        this.el.predictionInput.disabled = false;

        const result = this.state.lastResult;
        const multiplier = result.landedMultiplier;
        
        this.el.resultDisplay.innerText = multiplier;
        this.el.resultDisplay.style.color = this.state.colors[multiplier];
        this.el.resultDisplay.classList.remove('hidden');

        if (result.isWin) {
            const winAmount = parseInt(multiplier.replace('x', ''));
            app.showToast(`MATCH! You predicted correctly and won ${winAmount} HBAR!`, 'success');
            
            // Notification of payout
            if (result.payoutTransactionId) {
                console.log('Payout Tx:', result.payoutTransactionId);
            }
            
            app.reportGameResult(winAmount, 0);
            setTimeout(() => app.refreshBalance(), 1000);
        } else {
            app.showToast(`Landed on ${multiplier}. Prediction failed.`, 'error');
            app.reportGameResult(0, this.state.betAmount);
            setTimeout(() => app.refreshBalance(), 1000);
        }
    }
};

window.wheelGame = wheelGame;

document.addEventListener('DOMContentLoaded', () => {
    wheelGame.init();
});
