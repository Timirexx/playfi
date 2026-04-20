import { HashConnect } from "hashconnect";
import { LedgerId } from "@hashgraph/sdk";

// WalletConnect Project ID - Required for v4
// You can get yours at cloud.walletconnect.com
const PROJECT_ID = "1543435671e63ff12e86f80deed48dae";

const projectMetadata = {
    name: "PLAYFI",
    description: "Hedera Play-to-Earn Arcade",
    icons: ["https://cryptologos.cc/logos/hedera-hbar-logo.svg"],
    url: window.location.origin
};

// Initialize HashConnect with LedgerId and ProjectId as per v4 standard
export const hashconnect = new HashConnect(
    LedgerId.TESTNET,
    PROJECT_ID,
    projectMetadata,
    true // debug mode
);

/**
 * CONNECT WALLET HANDLER
 * Triggers the native HashConnect pairing modal.
 */
export const connectWallet = async () => {
    console.log("Connect button clicked"); // VERIFICATION LOG
    try {
        await hashconnect.openPairingModal();
    } catch (error) {
        console.error("Pairing Error:", error);
    }
};

/**
 * INITIALIZE WALLET MODULE
 * Sets up listeners and prepares the SDK.
 */
export const initWallet = async () => {
    const connectBtns = document.querySelectorAll('#connect-btn, .lock-overlay .btn');
    
    console.log("Initializing HashConnect SDK...");
    
    // Disable buttons until SDK is ready
    connectBtns.forEach(btn => {
        btn.disabled = true;
        btn.innerText = "Loading SDK...";
    });

    // Wire up event listeners before init()
    hashconnect.pairingEvent.on((msg) => {
        console.log("Pairing Event Resolved:", msg);
        if (msg.pairingData) {
            const accountId = msg.pairingData.accountIds[0];
            updateUI(accountId);
            localStorage.setItem("playfi_account", accountId);
        }
    });

    hashconnect.disconnectionEvent.on((msg) => {
        console.log("Wallet Disconnected:", msg);
        localStorage.removeItem("playfi_account");
        location.reload();
    });

    try {
        // Initialize the SDK
        await hashconnect.init();
        console.log("HashConnect SDK Ready.");

        // Restore button state
        connectBtns.forEach(btn => {
            btn.disabled = false;
            btn.innerText = "Connect Wallet";
        });

    } catch (error) {
        console.error("HashConnect Init Failed:", error);
        connectBtns.forEach(btn => {
            btn.innerText = "SDK Error";
        });
    }
};

/**
 * DOM BINDING
 * Ensure logic attaches after the page is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready - Binding Wallet Listeners");
    
    // Bind all connect buttons (navbar and overlay)
    const connectBtns = document.querySelectorAll('#connect-btn, .lock-overlay .btn');
    connectBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            connectWallet();
        });
    });

    // Start SDK initialization
    initWallet();
});

const updateUI = (accountId) => {
    const userProfile = document.getElementById('user-profile');
    const connectBtn = document.getElementById('connect-btn');
    const profileUsername = document.getElementById('profile-username');
    const appContainer = document.getElementById('app-container');

    if (profileUsername) profileUsername.innerText = accountId;
    if (userProfile) userProfile.classList.remove('hidden');
    if (connectBtn) connectBtn.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('is-locked');
};
