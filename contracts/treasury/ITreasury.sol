// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITreasury
 * @dev Interface the PlayFi game contracts (Mines, Spin to Win, Two Doors) use to
 * integrate with the shared treasury. Games forward each bet via receiveBet and
 * instruct payouts via payout; they never hold funds themselves.
 */
interface ITreasury {
    /// @dev Forward a player's bet into the treasury (game sends msg.value).
    function receiveBet(address player) external payable;

    /// @dev Instruct the treasury to pay a winner from the payout pool.
    function payout(address winner, uint256 amount) external;

    /// @dev HBAR currently available to cover payouts (excludes accrued fees).
    function payoutPool() external view returns (uint256);
}
