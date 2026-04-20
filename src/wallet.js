import { HashConnect } from "hashconnect";

const projectMetadata = {
    name: "PLAYFI",
    description: "Hedera Play-to-Earn Arcade",
    icons: ["https://cryptologos.cc/logos/hedera-hbar-logo.svg"],
    url: window.location.origin
};

// Initialize HashConnect
export const hashconnect = new HashConnect(
    "testnet",
    "1543435671e63ff12e86f80deed48dae", // Reusing the project ID as the hashconnect dapp id if applicable
    projectMetadata,
    true // debug mode
);

export const initWallet = async () => {
    console.log("Initializing HashConnect...");
    
    // Wire up events
    hashconnect.pairingEvent.on((msg) => {
        console.log("Pairing Event:", msg);
        if (msg.pairingData) {
            const accountId = msg.pairingData.accountIds[0];
            const evmAddress = msg.pairingData.accounts[0].evmAddress;
            
            updateUI(accountId);
            localStorage.setItem("playfi_account", accountId);
        }
    });

    hashconnect.disconnectionEvent.on((msg) => {
        console.log("Disconnected:", msg);
        localStorage.removeItem("playfi_account");
        location.reload();
    });

    await hashconnect.init();
};

export const connectWallet = async () => {
    try {
        await hashconnect.openPairingModal();
    } catch (error) {
        console.error("Pairing Error:", error);
    }
};

const updateUI = (accountId) => {
    const userProfile = document.getElementById('user-profile');
    const connectBtn = document.getElementById('connect-btn');
    const profileUsername = document.getElementById('profile-username');
    const appContainer = document.getElementById('app-container');

    if (userProfile && connectBtn && profileUsername) {
        profileUsername.innerText = accountId;
        userProfile.classList.remove('hidden');
        connectBtn.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('is-locked');
    }
};
