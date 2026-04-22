// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PlayFiLeaderboard
 * @dev Tracks performance across Spin, Crash, and Mines for global ranking.
 */
contract PlayFiLeaderboard {
    struct GameStats {
        uint256 sessionsPlayed;
        uint256 totalGains;   // In tinybars (8 decimals)
        uint256 totalLosses;  // In tinybars (8 decimals)
        int256 netProfit;     // In tinybars
        uint256 lastUpdate;
    }

    mapping(address => GameStats) public userStats;
    address[] public players;
    mapping(address => bool) public isKnownPlayer;

    event GameResultRecorded(address indexed player, uint256 won, uint256 lost, int256 totalNetProfit);

    /**
     * @dev Updates the user's gaming stats.
     * @param _won Amount won in this session (tinybars)
     * @param _lost Amount lost in this session (tinybars)
     */
    function recordResult(uint256 _won, uint256 _lost) external {
        GameStats storage stats = userStats[msg.sender];
        
        stats.sessionsPlayed++;
        stats.totalGains += _won;
        stats.totalLosses += _lost;
        stats.netProfit += (int256(_won) - int256(_lost));
        stats.lastUpdate = block.timestamp;

        if (!isKnownPlayer[msg.sender]) {
            players.push(msg.sender);
            isKnownPlayer[msg.sender] = true;
        }

        emit GameResultRecorded(msg.sender, _won, _lost, stats.netProfit);
    }

    /**
     * @dev Helper to get stats for a batch of players (for frontend ranking)
     */
    function getStats(address[] calldata _players) external view returns (GameStats[] memory) {
        GameStats[] memory results = new GameStats[](_players.length);
        for(uint256 i = 0; i < _players.length; i++) {
            results[i] = userStats[_players[i]];
        }
        return results;
    }

    function getAllPlayers() external view returns (address[] memory) {
        return players;
    }

    function getPlayerCount() external view returns (uint256) {
        return players.length;
    }
}
