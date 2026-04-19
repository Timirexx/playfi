const minesGame = {
    state: {
        isRunning: false,
        betAmount: 0,
        bombCount: 3,
        bombs: [],
        revealedCount: 0,
        currentMultiplier: 1.00,
        gameOver: false
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

    placeBet() {
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
        if (isNaN(amount) || amount <= 0 || amount > parseFloat(app.state.balance)) {
            app.showToast('Invalid bet or insufficient HBAR balance', 'error');
            return;
        }

        if (!app.updateBalance(-amount)) return;

        this.state.betAmount = amount;
        this.state.bombCount = parseInt(this.el.bombSelect.value);
        this.startGame();
    },

    startGame() {
        this.state.isRunning = true;
        this.state.gameOver = false;
        this.state.revealedCount = 0;
        this.state.currentMultiplier = 1.00;
        
        this.el.btn.innerText = 'Cash Out';
        this.el.multText.innerText = this.getNextMultiplier().toFixed(2) + 'x';
        this.el.betInput.disabled = true;
        this.el.bombSelect.disabled = true;

        // Generate bombs
        this.state.bombs = [];
        while (this.state.bombs.length < this.state.bombCount) {
            const r = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * 25);
            if (!this.state.bombs.includes(r)) {
                this.state.bombs.push(r);
            }
        }

        // Reset UI grid
        const cells = document.querySelectorAll('.mine-cell');
        cells.forEach(cell => {
            cell.className = 'mine-cell';
            cell.innerHTML = '';
        });
        
        app.showToast(`Mines started with ${this.state.betAmount} HBAR!`, 'success');
    },

    getNextMultiplier() {
        // Simple mock progression algorithm
        const remainingSafe = 25 - this.state.bombCount - this.state.revealedCount;
        if (remainingSafe <= 0) return this.state.currentMultiplier;
        
        // Base edge 1% roughly, increases dynamically
        const mult = 25 / remainingSafe * (1 - 0.03);
        return this.state.currentMultiplier * Math.max(1.05, mult);
    },

    clickCell(index, cellEl) {
        if (!this.state.isRunning || this.state.gameOver || cellEl.classList.contains('revealed')) return;

        if (this.state.bombs.includes(index)) {
            // Hit a bomb
            cellEl.classList.add('revealed', 'bomb');
            cellEl.innerHTML = '💣';
            this.crash();
        } else {
            // Hit a gem
            cellEl.classList.add('revealed', 'gem');
            cellEl.innerHTML = '💎';
            this.state.revealedCount++;
            
            this.state.currentMultiplier = this.getNextMultiplier();
            this.el.multText.innerText = this.getNextMultiplier().toFixed(2) + 'x';
            this.el.btn.innerText = `Cash Out (${(this.state.betAmount * this.state.currentMultiplier).toFixed(2)} HBAR)`;

            if (this.state.revealedCount === (25 - this.state.bombCount)) {
                // Perfect game
                this.cashOut();
            }
        }
    },

    cashOut() {
        if (!this.state.isRunning || this.state.gameOver) return;

        const winAmount = this.state.betAmount * this.state.currentMultiplier;
        app.updateBalance(winAmount);
        
        app.showToast(`Cashed out! Won ${winAmount.toFixed(2)} HBAR`, 'success');
        this.endGame(true);
    },

    crash() {
        this.state.gameOver = true;
        app.showToast(`Boom! You lost ${this.state.betAmount} HBAR.`, 'error');
        this.endGame(false);
    },

    endGame(won) {
        this.state.isRunning = false;
        this.el.btn.innerText = 'Start Game';
        this.el.multText.innerText = '0.00x';
        this.el.betInput.disabled = false;
        this.el.bombSelect.disabled = false;

        // Reveal bombs
        const cells = document.querySelectorAll('.mine-cell');
        this.state.bombs.forEach(bombIndex => {
            const cell = cells[bombIndex];
            if (!cell.classList.contains('revealed')) {
                cell.classList.add('revealed', 'bomb');
                cell.innerHTML = '💣';
                cell.style.opacity = '0.5';
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    minesGame.init();
});
