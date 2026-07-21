import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';

import Landing from './views/Landing';
import Home from './views/Home';
import Vault from './views/Vault';
import Mines from './views/Mines';
import Spin from './views/Spin';
import Leaderboard from './views/Leaderboard';
import TwoDoors from './views/TwoDoors';
import ToastContainer from './components/ui/ToastContainer';
import TxOverlay from './components/ui/TxOverlay';

const App = () => {
  return (
    <Router>
      <div id="app-container">
        <Navbar />
        
        <main className="content-area">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/hub" element={<Home />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/mines" element={<Mines />} />
            <Route path="/spin" element={<Spin />} />
            <Route path="/two-doors" element={<TwoDoors />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <TxOverlay />
        <ToastContainer />
      </div>
    </Router>
  );
};

export default App;
