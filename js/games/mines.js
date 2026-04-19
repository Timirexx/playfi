const minesGame = {
    state: {
        isRunning: false,
        betAmount: 0,
        bombCount: 5, // Default matching dropdown default
        bombs: [],
        revealedCount: 0,
        currentMultiplier: 1.00,
        gameOver: false,
        houseEdge: 0.10
    },

    el: {
        grid: null,
        btn: null,
        betInput: null,
        bombSelect: null,
        multText: null
    },

    init() {
        this.el.grid = document.getElementById('mines-grid');
        this.el.btn = document.getElementById('mines-action-btn');
        this.el.betInput = document.getElementById('mines-bet');
        this.el.bombSelect = document.getElementById('mines-count');
        this.el.multText = document.getElementById('mines-next-mult');

        if (this.el.grid) {
            this.generateGrid();
        }
    },

    generateGrid() {
        if (!this.el.grid) return;
        this.el.grid.innerHTML = '';
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement('div');
            cell.className = 'mine-cell';
            cell.dataset.index = i;
            cell.onclick = () => this.clickCell(i, cell);
            this.el.grid.appendChild(cell);
        }
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

        const amount = parseFloat(this.el.betInput.value);
        if (isNaN(amount) || amount <= 0) {
            app.showToast('Invalid bet amount', 'error');
            return;
        }

        // Balance check
        const currentBalance = parseFloat(app.state.balance);
        if (!isNaN(currentBalance) && amount > currentBalance) {
            app.showToast(`Insufficient balance! You only have ${currentBalance.toFixed(2)} HBAR.`, 'error');
            return;
        }

        this.el.btn.disabled = true;
        
        const success = await app.processBet(amount);
        if (!success) {
            this.el.btn.disabled = false;
            return;
        }

        this.state.betAmount = amount;
        this.state.bombCount = parseInt(this.el.bombSelect.value);
        this.startGame();
    },

    startGame() {
        this.state.isRunning = true;
        this.state.gameOver = false;
        this.state.revealedCount = 0;
        this.state.currentMultiplier = 1.00;
        
        this.el.btn.innerText = 'Start Game';
        this.el.btn.disabled = false;
        this.el.multText.innerText = this.calculateMultiplier(1).toFixed(2) + 'x';
        this.el.betInput.disabled = true;
        this.el.bombSelect.disabled = true;

        // Cashout is locked until at least 1 gem is revealed
        this.el.btn.onclick = null; // Disable click until gem revealed
        this.el.btn.style.opacity = '0.5';
        this.el.btn.title = 'Reveal at least 1 gem to Cash Out';

        // PRE-GENERATION: Board is final.
        this.state.bombs = [];
        const possibleIndices = Array.from({length: 25}, (_, i) => i);
        for (let i = possibleIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [possibleIndices[i], possibleIndices[j]] = [possibleIndices[j], possibleIndices[i]];
        }
        this.state.bombs = possibleIndices.slice(0, this.state.bombCount);

        const cells = document.querySelectorAll('.mine-cell');
        cells.forEach(cell => {
            cell.className = 'mine-cell';
            cell.innerHTML = '';
        });
        
        app.showToast('Grid armed. Find the gems!', 'info');
    },

    calculateMultiplier(k) {
        if (k === 0) return 1.0;
        const n = 25;
        const b = this.state.bombCount;
        
        let multiplier = 1.0;
        for (let i = 0; i < k; i++) {
            multiplier *= (n - i) / (n - b - i);
        }
        
        // Apply House Edge
        return multiplier * (1 - this.state.houseEdge);
    },

    clickCell(index, cellEl) {
        if (!this.state.isRunning || this.state.gameOver || cellEl.classList.contains('revealed')) return;

        // Ensure button lock during animation
        this.el.btn.disabled = true;

        if (this.state.bombs.includes(index)) {
            cellEl.classList.add('revealed', 'bomb');
            cellEl.innerHTML = '💣';
            this.crash();
        } else {
            cellEl.classList.add('revealed', 'gem');
            cellEl.innerHTML = '💎';
            this.state.revealedCount++;
            
            this.state.currentMultiplier = this.calculateMultiplier(this.state.revealedCount);
            
            const nextMult = this.calculateMultiplier(this.state.revealedCount + 1);
            this.el.multText.innerText = nextMult.toFixed(2) + 'x';

            // Enable Cash Out after at least 1 gem is revealed
            this.el.btn.innerText = `Cash Out (${(this.state.betAmount * this.state.currentMultiplier).toFixed(2)} HBAR)`;
            this.el.btn.style.opacity = '1';
            this.el.btn.title = '';
            this.el.btn.onclick = () => minesGame.placeBet();
            this.el.btn.disabled = false;

            if (this.state.revealedCount === (25 - this.state.bombCount)) {
                this.cashOut();
            }
        }
    },

    cashOut() {
        if (!this.state.isRunning || this.state.gameOver) return;

        const winAmount = this.state.betAmount * this.state.currentMultiplier;
        app.showToast(`CASHOUT SUCCESS! ${winAmount.toFixed(2)} HBAR added.`, 'success');
        
        // In simulation, we update the UI immediately
        setTimeout(() => app.refreshBalance(), 500);
        this.endGame(true);
    },

    crash() {
        this.state.gameOver = true;
        app.showToast(`Boom! You lost ${this.state.betAmount} HBAR.`, 'error');
        setTimeout(() => app.refreshBalance(), 500);
        this.endGame(false);
    },

    endGame(won) {
        this.state.isRunning = false;
        this.el.btn.innerText = 'Start Game';
        this.el.btn.style.opacity = '1';
        this.el.btn.title = '';
        this.el.btn.onclick = () => minesGame.placeBet();
        this.el.multText.innerText = '0.00x';
        this.el.betInput.disabled = false;
        this.el.bombSelect.disabled = false;
        this.el.btn.disabled = false;

        const cells = document.querySelectorAll('.mine-cell');
        this.state.bombs.forEach(bombIndex => {
            const cell = cells[bombIndex];
            if (cell && !cell.classList.contains('revealed')) {
                cell.classList.add('revealed', 'bomb', 'bomb-dim');
                cell.innerHTML = '💣';
            }
        });
    }
};

window.minesGame = minesGame;

document.addEventListener('DOMContentLoaded', () => {
    minesGame.init();
});
