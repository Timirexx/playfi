import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { hederaTestnet } from '@reown/appkit/networks'

export const PROJECT_ID = 'f55a7c9d55d65684c9f36147172d9a2e'

export const wagmiAdapter = new WagmiAdapter({
    projectId: PROJECT_ID,
    networks: [hederaTestnet]
})

export const modal = createAppKit({
    adapters: [wagmiAdapter],
    networks: [hederaTestnet],
    projectId: PROJECT_ID,
    metadata: {
        name: 'PLAYFI',
        description: 'Hedera Play-to-Earn Arcade',
        url: 'https://playfi-kohl.vercel.app',
        icons: ['https://cryptologos.cc/logos/hedera-hbar-logo.svg']
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#00f0ff',
        '--w3m-color-mix': '#00f0ff',
        '--w3m-color-mix-strength': 15
    }
})

export const connectWallet = async () => {
    console.log("[Reown] Opening modal...");
    try {
        await modal.open();
    } catch (e) {
        console.error("Reown Modal Error:", e);
    }
};

export const initWallet = async () => {
    // Reown handles its own initialization deeply, just enable buttons visually
    const connectBtns = document.querySelectorAll('#connect-btn, .lock-overlay .btn');
    connectBtns.forEach(btn => {
        btn.disabled = false;
        btn.innerText = "Connect Wallet";
    });
    return true;
};
