import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { hederaTestnet } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PROJECT_ID = 'f55a7c9d55d65684c9f36147172d9a2e';

// 1. Setup QueryClient
const queryClient = new QueryClient();

// 2. Setup Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
    projectId: PROJECT_ID,
    networks: [hederaTestnet]
});

// 3. Create Modal
export const modal = createAppKit({
    adapters: [wagmiAdapter],
    networks: [hederaTestnet],
    projectId: PROJECT_ID,
    metadata: {
        name: 'PLAYFI',
        description: 'Hedera Play-to-Earn Arcade',
        url: 'https://playfirepo.vercel.app',
        icons: ['https://cryptologos.cc/logos/hedera-hbar-logo.svg']
    },
    // Hardening permissions for HashPack/WalletConnect
    featuredWalletIds: [
        '9295305a-80c1-4034-8c01-7058df817e71', // HashPack Wallet ID
    ],
    // Explicitly request namespaces to prevent "Unauthorized" (4100) errors
    // HashPack needs to know we want to send transactions on Hedera EVM (EIP-155:296)
    allWallets: 'SHOW',
    includeWalletIds: [
        '9295305a-80c1-4034-8c01-7058df817e71', // HashPack
        'c57ca38d10b01c13f640e302008323a6774c86bf414-meta-mask', // MetaMask
    ],
    features: {
        analytics: true,
        email: false, 
        socials: false,
        onramp: false
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#00f0ff',
        '--w3m-color-mix': '#00f0ff',
        '--w3m-color-mix-strength': 15
    }
});

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
    const { address, isConnected } = useAccount();
    const { data: balanceData, refetch: refetchBalance } = useBalance({
        address: address,
    });
    const { disconnect } = useDisconnect();

    const [state, setState] = useState({
        address: null,
        isConnected: false,
        balance: '0.00',
        starPoints: parseInt(localStorage.getItem('playfi_star_points') || '0'),
        lastClaimTime: parseInt(localStorage.getItem('playfi_last_claim') || '0'),
        username: 'Guest',
        isRefreshing: false
    });

    useEffect(() => {
        // Sync points on mount in case they changed in another tab
        const savedPoints = parseInt(localStorage.getItem('playfi_star_points') || '0');
        const savedClaimTime = parseInt(localStorage.getItem('playfi_last_claim') || '0');
        setState(prev => ({ 
            ...prev, 
            starPoints: savedPoints,
            lastClaimTime: savedClaimTime
        }));
    }, []);

    useEffect(() => {
        if (isConnected && address) {
            // First, set basic connection state
            setState(prev => ({
                ...prev,
                address,
                isConnected: true
            }));

            // Then fetch extended metadata (username/balance) from Mirror Node
            const fetchAccountInfo = async () => {
                try {
                    const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${address}`);
                    if (response.ok) {
                        const data = await response.json();
                        const username = data.account || `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
                        const hbarBalance = data.balance ? (data.balance.balance / 100_000_000).toFixed(2) : '0.00';
                        
                        setState(prev => ({
                            ...prev,
                            username,
                            balance: hbarBalance
                        }));
                    }
                } catch (e) {
                    console.error("Mirror Node Fetch Error:", e);
                    // Fallback to Wagmi balance if mirror node fails
                    if (balanceData) {
                        setState(prev => ({
                            ...prev,
                            balance: parseFloat(balanceData.formatted).toFixed(2)
                        }));
                    }
                }
            };
            fetchAccountInfo();
        } else {
            setState(prev => ({
                ...prev,
                address: null,
                isConnected: false,
                balance: '0.00',
                username: 'Guest',
                isRefreshing: false
            }));
        }
    }, [isConnected, address, balanceData]);

    const connect = useCallback(async () => {
        try {
            await modal.open();
        } catch (e) {
            console.error("Connection Error:", e);
        }
    }, []);

    const claimDailyReward = useCallback(() => {
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours
        
        if (now - state.lastClaimTime >= cooldown) {
            const newPoints = state.starPoints + 50;
            localStorage.setItem('playfi_star_points', newPoints.toString());
            localStorage.setItem('playfi_last_claim', now.toString());
            
            setState(prev => ({
                ...prev,
                starPoints: newPoints,
                lastClaimTime: now
            }));
            return { success: true, points: 50 };
        } else {
            const remaining = cooldown - (now - state.lastClaimTime);
            return { success: false, remaining };
        }
    }, [state.lastClaimTime, state.starPoints]);

    const refreshBalance = useCallback(async () => {
        if (!address) return;
        setState(prev => ({ ...prev, isRefreshing: true }));
        
        try {
            // Refresh Wagmi balance
            await refetchBalance();
            
            // Refresh Mirror Node info
            const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${address}`);
            if (response.ok) {
                const data = await response.json();
                const hbarBalance = data.balance ? (data.balance.balance / 100_000_000).toFixed(2) : '0.00';
                setState(prev => ({ ...prev, balance: hbarBalance }));
            }
        } catch (e) {
            console.error("Manual Refresh Error:", e);
        } finally {
            setTimeout(() => setState(prev => ({ ...prev, isRefreshing: false })), 500);
        }
    }, [address, refetchBalance]);

    const updateStarPoints = useCallback(async (amount) => {
        const current = parseInt(localStorage.getItem('playfi_star_points') || '0');
        const next = current + amount;
        localStorage.setItem('playfi_star_points', next.toString());
        setState(prev => ({ ...prev, starPoints: next }));

        // Sync with backend
        if (address) {
            const API_BASE = window.location.hostname === 'localhost' ? "http://localhost:3001" : "https://playfi-backend.vercel.app";
            try {
                await fetch(`${API_BASE}/api/sync-stars`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, stars: next })
                });
            } catch (e) {
                console.error("Star Sync Error:", e);
            }
        }
    }, [address]);

    return (
        <WalletContext.Provider value={{ ...state, connect, disconnect, refreshBalance, claimDailyReward, updateStarPoints }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => useContext(WalletContext);
