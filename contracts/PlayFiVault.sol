// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PlayFiVault
 * @dev A DeFi staking vault meant for the Hedera Smart Contract Service (HSCS).
 * It tracks deposited HBAR (Total Value Locked) and emits auditable metrics.
 */
contract PlayFiVault {
    // Mapping to track TVL balances for individual users
    mapping(address => uint256) public balances;
    
    // Track total TVL within the contract across all users
    uint256 public totalValueLocked;

    // Emitted when a user stakes HBAR. Critical for indexing TVL metrics.
    event Deposited(address indexed user, uint256 amount);
    
    // Emitted when a user pulls HBAR out. 
    event Withdrawn(address indexed user, uint256 amount);

    /**
     * @notice Allows users to deposit raw, native HBAR into the vault.
     * @dev The value sent (msg.value) is automatically added to the contract balance.
     */
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than zero");

        // Checks-Effects-Interactions: Update state first
        balances[msg.sender] += msg.value;
        totalValueLocked += msg.value;

        // Emit metric verification event
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Allows a user to withdraw their deposited HBAR.
     * @dev Includes basic reentrancy protection by zeroing out the balance BEFORE transfer.
     */
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to withdraw");

        // Checks-Effects-Interactions: Zero out state FIRST to prevent reentrancy
        balances[msg.sender] = 0;
        totalValueLocked -= amount;

        // Effect verification event
        emit Withdrawn(msg.sender, amount);

        // Interaction: Send the native asset (HBAR on Hedera HSCS)
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }
}
