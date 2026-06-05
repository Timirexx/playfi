// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVault {
    function receiveBet() external payable;
    function settleGame(address user, uint256 winAmount, uint256 lossAmount) external;
}

/**
 * @title PlayFiGames
 * @dev On-chain routing for off-chain Provably Fair games.
 * Forwards bets directly to the Dedicated Treasury.
 */
contract PlayFiGames {
    IVault public vault;
    address public owner;

    event BetPlaced(address indexed user, string game, uint256 amount);

    constructor(address _vault) {
        vault = IVault(_vault);
        owner = msg.sender;
    }

    /**
     * @dev Generic entry point for placing a bet on any game.
     * The HBAR is immediately forwarded to the Treasury Vault's houseLiquidity.
     */
    function placeBet(string memory game) public payable {
        require(msg.value > 0, "PlayFi: Bet must be greater than 0");
        
        // Forward the bet directly to the Treasury
        vault.receiveBet{value: msg.value}();
        
        emit BetPlaced(msg.sender, game, msg.value);
    }
}
