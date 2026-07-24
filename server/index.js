import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleSpin } from './controllers/spinController.js';
import { startMines, revealTile, cashoutMines } from './controllers/minesController.js';
import { handleTwoDoors } from './controllers/twoDoorsController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['https://playfirepo.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'active', network: process.env.HEDERA_NETWORK || 'testnet' });
});

// In-memory Leaderboard Data (Replace with DB in production)
const leaderboard = new Map();

// Leaderboard Routes
app.get('/api/leaderboard', (req, res) => {
    const sorted = Array.from(leaderboard.entries())
        .map(([address, stars]) => ({ address, stars }))
        .sort((a, b) => b.stars - a.stars)
        .slice(0, 50); // Top 50
    res.json({ success: true, leaderboard: sorted });
});

app.post('/api/sync-stars', (req, res) => {
    const { address, stars } = req.body;
    if (!address) return res.status(400).json({ error: "Missing address" });
    
    // Update or set star count
    leaderboard.set(address, stars);
    res.json({ success: true, currentStars: stars });
});

// Spin Route
app.post('/api/spin', handleSpin);

// Two Doors Route
app.post('/api/twodoors', handleTwoDoors);

// Mines Routes
app.post('/api/mines/start', startMines);
app.post('/api/mines/reveal', revealTile);
app.post('/api/mines/cashout', cashoutMines);

// On Vercel the app runs as a serverless function, which needs the Express app
// exported as the request handler — calling app.listen() there doesn't bind a
// reachable port and leaves routes returning 404. Locally we still listen.
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 PlayFi Backend running on http://localhost:${PORT}`);
    });
}

export default app;
