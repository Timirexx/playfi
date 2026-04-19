const wheelGame = {
    state: {
        isRunning: false,
        betAmount: 0,
        currentRotation: 0,
        slices: [
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '1.2x', mult: 1.2, color: '#00ccff' },
            { text: '2x', mult: 2.0, color: '#00e676' },
            { text: '0x', mult: 0, color: '#ff3366' },
            { text: '5x', mult: 5.0, color: '#ffea00' },
            { text: '1.5x', mult: 1.5, color: '#aa00ff' }
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
        const ctx = this.el.ctx;
        const width = this.el.canvas.width;
        const height = this.el.canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = cx - 10;

        const sliceAngle = (2 * Math.PI) / this.state.slices.length;

        ctx.clearRect(0, 0, width, height);
        
        // Draw slice background layer
        for (let i = 0; i < this.state.slices.length; i++) {
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.fillStyle = this.state.slices[i].color;
            ctx.fill();
            
            // Draw slice borders
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#050508';
            ctx.stroke();

            // Draw text
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#050508';
            ctx.font = 'bold 24px Outfit';
            ctx.fillText(this.state.slices[i].text, radius - 20, 8);
            ctx.restore();
        }

        // Draw center
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
        ctx.fillStyle = '#050508';
        ctx.fill();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 4;
        ctx.stroke();
    },

    spin() {
        if (!app.state.isConnected) {
            app.showToast('Please connect your wallet first!', 'error');
            app.openWalletModal();
            return;
        }

        if (this.state.isRunning) return;

        const amount = parseFloat(this.el.betInput.value);
        if (isNaN(amount) || amount <= 0 || amount > parseFloat(app.state.balance)) {
            app.showToast('Invalid bet or insufficient HBAR balance', 'error');
            return;
        }

        if (!app.updateBalance(-amount)) return;

        this.state.betAmount = amount;
        this.state.isRunning = true;
        
        this.el.btn.disabled = true;
        this.el.betInput.disabled = true;
        this.el.resultDisplay.classList.add('hidden');

        // Logic
        // We pick a random segment
        const numSlices = this.state.slices.length;
        // Pseudo-random fair selection
        const rand = crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1);
        
        // House edge tweak: If rand lands on high mult (5x), re-roll 50% of the time
        let winningIndex = Math.floor(rand * numSlices);
        if (this.state.slices[winningIndex].mult === 5 && Math.random() < 0.5) {
             winningIndex = 0; // fallback to 0x slice
        }

        const sliceAngleDeg = 360 / numSlices;
        
        // Target angle points to the center of the winning slice
        // Note: The pointer is at top (-90 deg from standard 0 at right).
        // Standard drawn slice 0 is from 0 to 60 deg on right side.
        // We need to rotate the canvas so the winning slice is at 270 deg / -90 deg.
        
        const extraSpins = 4; // 4 full rotations
        
        // The angle needed to place slice 0 at top pointer is -90 - 30 = -120deg (or 240deg).
        // Let's just do mathematical offset.
        // Actually, CSS rotation goes clockwise.
        // We want to stop at: baseOffset + (numSlices - winningIndex) * sliceAngleDeg
        const stopAngle = (extraSpins * 360) + (360 - (winningIndex * sliceAngleDeg)) - 90 - (sliceAngleDeg/2);
        
        this.state.currentRotation += stopAngle;

        this.el.canvas.style.transform = `rotate(${this.state.currentRotation}deg)`;

        // Wait for CSS transition (3s)
        setTimeout(() => {
            this.endSpin(winningIndex);
        }, 3000);
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
            app.updateBalance(winAmount);
            app.showToast(`You won ${winAmount.toFixed(2)} HBAR!`, 'success');
        } else {
            app.showToast(`You lost ${this.state.betAmount} HBAR.`, 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    wheelGame.init();
});
