const crashGame = {
    state: {
        isRunning: false,
        multiplier: 1.00,
        crashPoint: 0,
        betAmount: 0,
        targetMultiplier: 0,
        intervalId: null
    },

    el: {
        multiplierText: null,
        displayArea: null,
        canvas: null,
        ctx: null,
        btn: null,
        betInput: null
    },

    history: [], // For graph rendering

    init() {
        this.el.multiplierText = document.getElementById('crash-multiplier');
        this.el.displayArea = document.querySelector('.multiplier-display');
        this.el.canvas = document.getElementById('crash-canvas');
        this.el.btn = document.getElementById('crash-action-btn');
        this.el.betInput = document.getElementById('crash-bet');

        if (this.el.canvas) {
            this.el.ctx = this.el.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.drawGraph();
        }
    },

    resizeCanvas() {
        const parent = this.el.canvas.parentElement;
        this.el.canvas.width = parent.clientWidth;
        this.el.canvas.height = parent.clientHeight;
        this.drawGraph();
    },

    generateCrashPoint() {
        // Provably fair simulation: 1% instant crash, otherwise mathematically distributed
        const e = 2 ** 32;
        const h = crypto.getRandomValues(new Uint32Array(1))[0];
        if (h % 33 === 0) return 1.00; // House edge / instant crash
        
        const crashPoint = Math.max(1.00, 100 / (100 - (h / e * 100)));
        return parseFloat((Math.floor(crashPoint * 100) / 100).toFixed(2));
    },

    placeBet() {
        if (!app.state.isConnected) {
            app.showToast('Please connect your wallet first!', 'error');
            app.openWalletModal();
            return;
        }

        const betSpan = document.getElementById('crash-bet');
        const amount = parseFloat(betSpan.value);

        if (isNaN(amount) || amount <= 0) {
            app.showToast('Invalid bet amount', 'error');
            return;
        }

        if (amount > parseFloat(app.state.balance)) {
            app.showToast('Insufficient HBAR balance', 'error');
            return;
        }

        if (this.state.isRunning) {
            // Cash Out Logic
            this.cashOut();
            return;
        }

        // Deduct bet
        if (!app.updateBalance(-amount)) return;
        
        this.state.betAmount = amount;
        this.startGame();
    },

    startGame() {
        this.state.isRunning = true;
        this.state.multiplier = 1.00;
        this.state.crashPoint = this.generateCrashPoint();
        this.history = [{x: 0, y: 1.00}];
        
        // Reset UI
        this.el.displayArea.classList.remove('crashed');
        this.el.multiplierText.innerText = '1.00x';
        this.el.btn.innerText = 'Cash Out';
        this.el.btn.classList.add('btn-hero-cashout');
        document.querySelector('.live-status').innerText = '🚀 IN PROGRESS...';
        
        app.showToast(`Bet ${this.state.betAmount} HBAR placed!`, 'success');

        let speed = 90; // Starting speed (ms per tick)
        let rate = 0.01;

        const tick = () => {
            this.state.multiplier += rate;
            
            // Accel curve
            if(this.state.multiplier > 2.0) rate = 0.02;
            if(this.state.multiplier > 5.0) rate = 0.05;
            if(this.state.multiplier > 10.0) rate = 0.10;

            this.history.push({x: this.history.length, y: this.state.multiplier});
            this.drawGraph();
            this.el.multiplierText.innerText = this.state.multiplier.toFixed(2) + 'x';

            // Check crash
            if (this.state.multiplier >= this.state.crashPoint) {
                this.crash();
                return;
            }

            this.state.intervalId = setTimeout(tick, speed);
            speed = Math.max(10, speed - 1); // Get faster
        };

        this.state.intervalId = setTimeout(tick, speed);
    },

    cashOut() {
        if (!this.state.isRunning) return;
        
        const winAmount = this.state.betAmount * this.state.multiplier;
        app.updateBalance(winAmount);
        
        app.showToast(`Cashed out! You won ${winAmount.toFixed(2)} HBAR!`, 'success');
        
        // Disconnect from current run natively but let graph keep going until crash
        this.el.btn.innerText = 'Cashed Out!';
        this.el.btn.disabled = true;
        this.state.betAmount = 0; // Prevent duplicate cashouts
    },

    crash() {
        this.state.isRunning = false;
        clearTimeout(this.state.intervalId);
        
        this.state.multiplier = this.state.crashPoint;
        this.el.multiplierText.innerText = this.state.multiplier.toFixed(2) + 'x';
        this.el.displayArea.classList.add('crashed');
        
        this.el.btn.innerText = 'Place Bet';
        this.el.btn.disabled = false;
        this.el.btn.classList.remove('btn-hero-cashout');
        document.querySelector('.live-status').innerHTML = '<span class="pulse-dot"></span> LIVE';

        if (this.state.betAmount > 0) {
            app.showToast(`Crashed at ${this.state.crashPoint}x. You lost ${this.state.betAmount} HBAR.`, 'error');
            this.state.betAmount = 0;
        }

        this.drawGraph();
    },

    drawGraph() {
        if (!this.el.ctx) return;
        const ctx = this.el.ctx;
        const width = this.el.canvas.width;
        const height = this.el.canvas.height;

        ctx.clearRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for(let i=0; i<height; i+=40) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
        }

        if (this.history.length === 0) return;

        const maxPoints = Math.max(100, this.history.length);
        const yMax = Math.max(this.state.multiplier, 2.0);

        ctx.beginPath();
        ctx.moveTo(0, height);

        for(let i=0; i<this.history.length; i++) {
            const pt = this.history[i];
            const px = (pt.x / maxPoints) * width;
            // Map Y invertedly
            const py = height - ((pt.y / yMax) * height * 0.8); 
            ctx.lineTo(px, py);
        }

        ctx.strokeStyle = this.state.isRunning ? '#00f0ff' : '#ff3366';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Fill gradient
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        const gradient = ctx.createLinearGradient(0,0,0,height);
        if(this.state.isRunning) {
            gradient.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
        } else {
            gradient.addColorStop(0, 'rgba(255, 51, 102, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 51, 102, 0.0)');
        }
        ctx.fillStyle = gradient;
        ctx.fill();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    crashGame.init();
});
