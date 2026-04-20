import { HashConnect } from "hashconnect";
import { LedgerId } from "@hashgraph/sdk";

// WalletConnect Project ID - Required for v4
const PROJECT_ID = "1543435671e63ff12e86f80deed48dae";

const projectMetadata = {
    name: "PLAYFI",
    description: "Hedera Play-to-Earn Arcade",
    icons: ["https://cryptologos.cc/logos/hedera-hbar-logo.svg"],
    url: window.location.origin
};

// Export raw HashConnect instance so app.js can manage global state events
export const hashconnect = new HashConnect(
    LedgerId.TESTNET,
    PROJECT_ID,
    projectMetadata,
    true // debug mode
);

export const connectWallet = async () => {
    console.log("[HashConnect] Triggering pairing modal...");
    try {
        await hashconnect.openPairingModal();
    } catch (error) {
        console.error("Pairing Error:", error);
    }
};

export const initWallet = async () => {
    console.log("[HashConnect] Initializing SDK...");
    try {
        await hashconnect.init();
        console.log("[HashConnect] SDK Ready.");
        return true;
    } catch (error) {
        console.error("[HashConnect] Init Failed:", error);
        return false;
    }
};
