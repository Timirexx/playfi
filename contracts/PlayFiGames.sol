// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVault {
    function userBalances(address user) external view returns (uint256);
    function settleGame(address user, uint256 winAmount, uint256 lossAmount) external;
}

/**
 * @title PlayFiGames
 * @dev On-chain logic for Spin to Win and Mines Field.
 * Integrates with PlayFiVault for balance management.
 */
contract PlayFiGames {
    IVault public vault;
    address public owner;

    // --- SPIN CONFIG ---
    uint256[] public spinMultipliers = [
        1, 2, 1, 4, 1, 2, 1, 5, 1, 2, 1, 4, 
        1, 2, 1, 10, 1, 2, 1, 4, 1, 2, 1, 5, 
        1, 2, 1, 4, 1, 2, 1, 20, 1, 2, 1, 40
    ];

    // --- MINES CONFIG ---
    struct MinesGame {
        uint256 betAmount;
        uint256 minesCount;
        uint256 revealedCount;
        uint256 seed; // Generated at start
        bool active;
    }
    mapping(address => MinesGame) public activeMinesGames;

    event SpinPlayed(address indexed user, uint256 bet, uint256 multiplier, uint256 winAmount);
    event MinesStarted(address indexed user, uint256 bet, uint256 minesCount);
    event MinesRevealed(address indexed user, uint256 tileIndex, bool isMine);
    event MinesCashout(address indexed user, uint256 payout);

    constructor(address _vault) {
        vault = IVault(_vault);
        owner = msg.sender;
    }

    // --- SPIN GAME ---

    /**
     * @dev Play Spin to Win. 
     * prediction: The multiplier index the user is betting on (0-35).
     */
    function playSpin(uint256 amount) public {
        require(vault.userBalances(msg.sender) >= amount, "PlayFi: Insufficient vault balance");
        
        // Randomness using prevrandao (available on Hedera Testnet)
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender))) % 36;
        uint256 multiplier = spinMultipliers[randomIndex];
        
        uint256 winAmount = amount * multiplier;
        
        // Settle in Vault
        // If multiplier is 1x, it's technically a "push" (win = bet, loss = bet)
        // We pass the net result
        if (multiplier > 1) {
            vault.settleGame(msg.sender, winAmount, amount);
        } else if (multiplier < 1) {
             vault.settleGame(msg.sender, 0, amount);
        } else {
            // 1x payout - nothing changes in balance but we log it
        }

        emit SpinPlayed(msg.sender, amount, multiplier, winAmount);
    }

    // --- MINES GAME ---

    function startMines(uint256 minesCount, uint256 amount) public {
        require(minesCount >= 1 && minesCount <= 29, "PlayFi: Invalid mines count");
        require(vault.userBalances(msg.sender) >= amount, "PlayFi: Insufficient vault balance");
        require(!activeMinesGames[msg.sender].active, "PlayFi: Game already active");

        activeMinesGames[msg.sender] = MinesGame({
            betAmount: amount,
            minesCount: minesCount,
            revealedCount: 0,
            seed: uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender))),
            active: true
        });

        emit MinesStarted(msg.sender, amount, minesCount);
    }

    function revealTile(uint256 tileIndex) public {
        MinesGame storage game = activeMinesGames[msg.sender];
        require(game.active, "PlayFi: No active game");
        require(tileIndex < 30, "PlayFi: Invalid tile");

        // Determine if tile is a mine using the seed
        bool isMine = (uint256(keccak256(abi.encodePacked(game.seed, tileIndex))) % 30) < game.minesCount;

        if (isMine) {
            // User lost
            vault.settleGame(msg.sender, 0, game.betAmount);
            game.active = false;
            emit MinesRevealed(msg.sender, tileIndex, true);
        } else {
            game.revealedCount++;
            emit MinesRevealed(msg.sender, tileIndex, false);
            
            // Auto-cashout if all safe tiles revealed
            if (game.revealedCount == (30 - game.minesCount)) {
                cashoutMines();
            }
        }
    }

    function cashoutMines() public {
        MinesGame storage game = activeMinesGames[msg.sender];
        require(game.active, "PlayFi: No active game");
        require(game.revealedCount > 0, "PlayFi: Must reveal at least one tile");

        uint256 payout = calculateMinesPayout(game.betAmount, game.minesCount, game.revealedCount);
        
        vault.settleGame(msg.sender, payout, game.betAmount);
        game.active = false;
        
        emit MinesCashout(msg.sender, payout);
    }

    function calculateMinesPayout(uint256 bet, uint256 mines, uint256 revealed) public pure returns (uint256) {
        // Simplified multiplier logic: (30 / (30 - mines)) ^ revealed
        // For a smart contract, we use a fixed-point approximation or a simple table
        // Here we'll use a basic increasing scale for demonstration
        uint256 multiplier = 100; // 1.00x base in percentage
        for(uint256 i = 0; i < revealed; i++) {
            multiplier = (multiplier * 30) / (30 - mines);
        }
        return (bet * multiplier) / 100;
    }
}
