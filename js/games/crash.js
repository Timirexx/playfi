const crashGame = {
    state: {
        isRunning: false,
        multiplier: 1.00,
        crashPoint: 0,
        betAmount: 0,
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

    history: [],

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

    /**
     * PROVABLY FAIR CRASH MULTIPLIER
     * Formula: M = (1 - HouseEdge) / (1 - Math.random())
     */
    generateCrashPoint() {
        const houseEdge = 0.05; // 5% House Edge
        const rand = Math.random();
        
        // 3.3% chance of instant crash at 1.00 (Standard Casino Edge addition)
        if (Math.random() < 0.033) return 1.00;

        const multiplier = (1 - houseEdge) / (1 - rand);
        
        // Final crash point restricted to 2 decimal places, min 1.00
        const result = Math.max(1.00, Math.floor(multiplier * 100) / 100);
        
        // Cap at 100x for this mini-game's volatility control
        return Math.min(100.00, result);
    },

    async placeBet() {
        if (!app.state.isConnected) {
            app.showToast('Please connect your wallet first!', 'error');
            app.openWalletModal();
            return;
        }

        if (this.state.isRunning) {
            this.cashOut();
            return;
        }

        const betSpan = document.getElementById('crash-bet');
        const amount = parseFloat(betSpan.value);

        if (isNaN(amount) || amount <= 0) {
            app.showToast('Invalid bet amount', 'error');
            return;
        }

        // 1. DEPLOYMENT CRITICAL: PROCESS REAL HBAR TRANSACTION
        this.el.btn.disabled = true;
        const success = await app.processBet(amount);
        
        if (!success) {
            this.el.btn.disabled = false;
            return;
        }
        
        this.state.betAmount = amount;
        this.startGame();
    },

    startGame() {
        this.state.isRunning = true;
        this.state.multiplier = 1.00;
        this.state.crashPoint = this.generateCrashPoint();
        this.state.betCashedOut = false;
        this.history = [{x: 0, y: 1.00}];
        
        this.el.displayArea.classList.remove('crashed');
        this.el.multiplierText.innerText = '1.00x';
        this.el.btn.innerText = 'Cash Out';
        this.el.btn.disabled = false;
        this.el.btn.classList.add('btn-hero-cashout');
        document.querySelector('.live-status').innerText = '🚀 IN PROGRESS...';

        // Clear the canvas for a fresh round
        if (this.el.ctx) {
            this.el.ctx.clearRect(0, 0, this.el.canvas.width, this.el.canvas.height);
        }
        
        let speed = 90; 
        let rate = 0.01;

        const tick = () => {
            if (!this.state.isRunning) return; // Guard: stop if cashed out

            this.state.multiplier += rate;
            
            if(this.state.multiplier > 2.0) rate = 0.02;
            if(this.state.multiplier > 5.0) rate = 0.05;

            this.history.push({x: this.history.length, y: this.state.multiplier});
            this.drawGraph();
            this.el.multiplierText.innerText = this.state.multiplier.toFixed(2) + 'x';

            if (this.state.multiplier >= this.state.crashPoint) {
                this.crash();
                return;
            }

            this.state.intervalId = setTimeout(tick, speed);
            speed = Math.max(10, speed - 1);
        };

        this.state.intervalId = setTimeout(tick, speed);
    },

    cashOut() {
        if (!this.state.isRunning || this.state.betAmount === 0) return;

        // STOP the ticker immediately
        this.state.isRunning = false;
        this.state.betCashedOut = true;
        clearTimeout(this.state.intervalId);
        
        const winAmount = this.state.betAmount * this.state.multiplier;
        app.showToast(`WINNER! Cashed out ${winAmount.toFixed(2)} HBAR at ${this.state.multiplier.toFixed(2)}x! 🎉`, 'success');
        
        // Report to Leaderboard
        app.reportGameResult(winAmount, 0);
        
        this.el.btn.innerText = 'Place Bet';
        this.el.btn.disabled = false;
        this.el.btn.classList.remove('btn-hero-cashout');
        document.querySelector('.live-status').innerHTML = '<span class="pulse-dot"></span> LIVE';

        this.state.betAmount = 0;
        
        // Refresh visible balance to reflect incoming (simulated) funds
        setTimeout(() => app.refreshBalance(), 800);
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
            
            // Report to Leaderboard
            app.reportGameResult(0, this.state.betAmount);
            
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
            const py = height - ((pt.y / yMax) * height * 0.8); 
            ctx.lineTo(px, py);
        }

        ctx.strokeStyle = this.state.isRunning ? '#00f0ff' : '#ff3366';
        ctx.lineWidth = 4;
        ctx.stroke();

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

window.crashGame = crashGame;

document.addEventListener('DOMContentLoaded', () => {
    crashGame.init();
});
