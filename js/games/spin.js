const wheelGame = {
    state: {
        isRunning: false,
        betAmount: 0,
        currentRotation: 0,
        // 10 Segments: 8 Losses, 2 Wins (20% Win Rate)
        slices: [
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '1.5x', mult: 1.5, color: '#00ccff' },
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '5x', mult: 5, color: '#ffea00' },
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '0x', mult: 0, color: '#ff3366' }
        ]
    },

    el: {
        canvas: null,
        ctx: null,
        btn: null,
        betInput: null,
        resultDisplay: null
    },

    init() {
        this.el.canvas = document.getElementById('wheel-canvas');
        if (!this.el.canvas) return;

        this.el.ctx = this.el.canvas.getContext('2d');
        this.el.btn = document.getElementById('wheel-action-btn');
        this.el.betInput = document.getElementById('wheel-bet');
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
        const sliceAngle = (2 * Math.PI) / this.state.slices.length;

        ctx.clearRect(0, 0, width, height);
        
        for (let i = 0; i < this.state.slices.length; i++) {
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.fillStyle = this.state.slices[i].color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#050508';
            ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#050508';
            ctx.font = 'bold 20px Outfit';
            ctx.fillText(this.state.slices[i].text, radius - 20, 8);
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
        ctx.fillStyle = '#050508';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        ctx.stroke();
    },

    async spin() {
        if (!app.state.isConnected || this.state.isRunning) return;

        const amount = parseFloat(this.el.betInput.value);
        if (isNaN(amount) || amount <= 0) {
            app.showToast('Invalid bet amount', 'error');
            return;
        }

        this.el.btn.disabled = true;
        
        // 1. DEDUCT BET INSTANTLY (ON-CHAIN)
        const success = await app.processBet(amount);
        if (!success) {
            this.el.btn.disabled = false;
            return;
        }

        this.state.betAmount = amount;
        this.state.isRunning = true;
        this.el.betInput.disabled = true;
        this.el.resultDisplay.classList.add('hidden');

        // BIASED SELECTION (80% Loss, 20% Win)
        const winningIndex = Math.floor(Math.random() * this.state.slices.length);
        
        const numSlices = this.state.slices.length;
        const sliceAngleDeg = 360 / numSlices;
        const extraSpins = 10; 
        
        const sliceCenter = (winningIndex * sliceAngleDeg) + (sliceAngleDeg / 2);
        const rotationNeeded = (270 - sliceCenter); // land at top pointer
        
        this.state.currentRotation += (extraSpins * 360) + rotationNeeded;

        this.el.canvas.style.transition = 'transform 4s cubic-bezier(0.15, 0, 0.15, 1)';
        this.el.canvas.style.transform = `rotate(${this.state.currentRotation}deg)`;

        setTimeout(() => {
            this.endSpin(winningIndex);
        }, 4100);
    },

    endSpin(index) {
        this.state.isRunning = false;
        this.el.btn.disabled = false;
        this.el.betInput.disabled = false;

        const slice = this.state.slices[index];
        this.el.resultDisplay.innerText = slice.text;
        this.el.resultDisplay.style.color = slice.color;
        this.el.resultDisplay.classList.remove('hidden');

        if (slice.mult > 0) {
            const winAmount = this.state.betAmount * slice.mult;
            app.showToast(`JACKPOT! You won ${winAmount.toFixed(2)} HBAR.`, 'success');
            setTimeout(() => app.refreshBalance(), 500);
        } else {
            app.showToast(`Better luck next time! Lost ${this.state.betAmount} HBAR.`, 'error');
        }
    }
};

window.wheelGame = wheelGame;

document.addEventListener('DOMContentLoaded', () => {
    wheelGame.init();
});
