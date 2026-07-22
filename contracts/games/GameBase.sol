// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameBase
 * @dev Shared treasury/security scaffolding for PlayFi's independent per-game contracts.
 * Inherited (not deployed on its own) so each concrete game contract compiles into its
 * own standalone bytecode — updating this file only affects contracts deployed after
 * the change; already-deployed games are untouched.
 *
 * Separates two roles deliberately:
 * - `owner` (Ownable): cold-storage-grade admin key. Can pause, sweep funds, and
 *   rotate the backend signer, but never touches day-to-day gameplay.
 * - `backendSigner`: hot wallet the off-chain game server uses to resolve rounds.
 *   If this key is ever compromised, the owner can rotate it without redeploying,
 *   and a compromised backend signer alone cannot pause, withdraw house funds,
 *   or change who the backend signer is.
 */
abstract contract GameBase is Ownable, Pausable, ReentrancyGuard {
    /// @dev Total HBAR (in tinybars) available to cover player payouts.
    uint256 public houseLiquidity;

    /// @dev Hot wallet authorized to resolve rounds. Distinct from `owner`.
    address public backendSigner;

    event HouseFunded(uint256 amount);
    event HouseWithdrawn(uint256 amount);
    event BackendSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    error NotBackendSigner();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientLiquidity();
    error InsufficientContractBalance();
    error TransferFailed();

    constructor(address initialOwner, address initialBackendSigner) Ownable(initialOwner) {
        if (initialBackendSigner == address(0)) revert ZeroAddress();
        backendSigner = initialBackendSigner;
        emit BackendSignerUpdated(address(0), initialBackendSigner);
    }

    modifier onlyBackend() {
        if (msg.sender != backendSigner && msg.sender != owner()) revert NotBackendSigner();
        _;
    }

    /// @dev Rotate the hot backend key without redeploying the contract.
    function setBackendSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit BackendSignerUpdated(backendSigner, newSigner);
        backendSigner = newSigner;
    }

    /// @dev Pause new bets/resolutions. Existing house funds remain withdrawable by the owner.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Top up the payout reserve.
    function fundHouse() external payable onlyOwner {
        if (msg.value == 0) revert ZeroAmount();
        houseLiquidity += msg.value;
        emit HouseFunded(msg.value);
    }

    /// @dev Pull house profits/liquidity back out.
    function withdrawHouse(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > houseLiquidity) revert InsufficientLiquidity();
        if (amount > address(this).balance) revert InsufficientContractBalance();

        houseLiquidity -= amount;
        (bool success, ) = payable(owner()).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit HouseWithdrawn(amount);
    }

    /**
     * @dev Break-glass recovery: sweeps the entire contract balance to the owner.
     * Intended only for contract deprecation/migration, not routine operation.
     * Callable only while paused, so it can't be used to silently drain a live game.
     */
    function emergencyWithdraw() external onlyOwner whenPaused nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();

        houseLiquidity = 0;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();

        emit EmergencyWithdrawal(owner(), balance);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
