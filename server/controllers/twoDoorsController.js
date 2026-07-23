import { ethers } from "ethers";
import dotenv from "dotenv";
import { TWO_DOORS_ADDRESS, TWO_DOORS_ABI, TWO_DOORS_STATUS } from "../config/twoDoors.js";

dotenv.config();

const HASHIO_RPC = "https://testnet.hashio.io/api";

/**
 * Two Doors resolution (keeper role).
 *
 * With the on-chain PRNG design, the backend no longer decides the outcome — it
 * only *triggers* the reveal. The player has already:
 *   1. placeBet()      — staked HBAR into the Two Doors contract
 *   2. chooseDoor(1|2) — committed to a door on-chain
 * This endpoint calls resolveGame(player), which asks Hedera's PRNG for the
 * treasure door on-chain, pays 2x on a win, and emits GameWon / GameLost. We read
 * the result straight from that event and return it to the frontend to reveal.
 */
export const handleTwoDoors = async (req, res) => {
    const { userAddress } = req.body;

    console.log(`[TWO DOORS] Resolve request for ${userAddress}`);

    if (!userAddress || !ethers.isAddress(userAddress)) {
        return res.status(400).json({ success: false, error: "Missing or invalid userAddress" });
    }
    if (TWO_DOORS_ADDRESS === "0x0000000000000000000000000000000000000000") {
        return res.status(500).json({ success: false, error: "Two Doors contract not deployed yet." });
    }
    if (!process.env.TREASURY_PRIVATE_KEY) {
        return res.status(500).json({ success: false, error: "Server signer not configured." });
    }

    try {
        const provider = new ethers.JsonRpcProvider(HASHIO_RPC);
        const wallet = new ethers.Wallet(process.env.TREASURY_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(TWO_DOORS_ADDRESS, TWO_DOORS_ABI, wallet);

        // Confirm the player actually has a door-chosen game awaiting resolution.
        // (resolveGame would revert otherwise, but checking first gives a cleaner error.)
        const game = await contract.getGame(userAddress);
        if (Number(game.status) !== TWO_DOORS_STATUS.DOOR_CHOSEN) {
            return res.status(400).json({
                success: false,
                error: "No door-chosen game to resolve. Stake and pick a door first.",
            });
        }

        // Trigger the on-chain PRNG reveal + payout.
        const tx = await contract.resolveGame(userAddress, { gasLimit: 600000 });
        const receipt = await tx.wait();

        // Read the outcome from the emitted event.
        let isWin = null;
        let treasureDoor = null;
        let selectedDoor = Number(game.chosenDoor);
        let payout = "0";

        for (const log of receipt.logs) {
            let parsed;
            try {
                parsed = contract.interface.parseLog(log);
            } catch {
                continue; // not one of our events
            }
            if (parsed.name === "GameWon") {
                isWin = true;
                selectedDoor = Number(parsed.args.chosenDoor);
                treasureDoor = Number(parsed.args.treasureDoor);
                payout = parsed.args.payout.toString();
            } else if (parsed.name === "GameLost") {
                isWin = false;
                selectedDoor = Number(parsed.args.chosenDoor);
                treasureDoor = Number(parsed.args.treasureDoor);
            }
        }

        if (isWin === null) {
            // Should not happen if the tx succeeded, but fall back to reading state.
            const resolved = await contract.getGame(userAddress);
            isWin = resolved.won;
            treasureDoor = Number(resolved.treasureDoor);
        }

        return res.json({
            success: true,
            isWin,
            selectedDoor,
            treasureDoor,
            payout,                       // in weibars (18 decimals)
            payoutHbar: ethers.formatEther(payout),
            transactionHash: receipt.hash,
        });
    } catch (error) {
        console.error("[TWO DOORS] Resolve error:", error);
        return res.status(500).json({
            success: false,
            error: error.reason || error.shortMessage || "Failed to resolve game.",
        });
    }
};
