// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlayFiVault is Ownable {
    IERC20 public playToken;
    
    // Reward rate: 1 HBAR locked for 1 second generates 11574074074074 wei of PLAY
    // This equals exactly 1 PLAY token per 24 hours per HBAR staked.
    uint256 public rewardRatePerSecond = 11574074074074; 
    
    struct Stake {
        uint256 amount;
        uint256 lastClaimTimestamp;
    }

    mapping(address => Stake) public stakes;
    uint256 public totalValueLocked;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event YieldClaimed(address indexed user, uint256 yield);

    constructor(address _playToken) Ownable(msg.sender) {
        playToken = IERC20(_playToken);
    }

    // View function to calculate pending yield passively
    function calculateYield(address user) public view returns (uint256) {
        Stake memory userStake = stakes[user];
        if (userStake.amount == 0 || userStake.lastClaimTimestamp == 0) {
            return 0;
        }
        
        uint256 timeStaked = block.timestamp - userStake.lastClaimTimestamp;
        
        // reward = (amount_staked / 1 ether) * timeStaked * rewardRatePerSecond
        uint256 reward = (userStake.amount * timeStaked * rewardRatePerSecond) / 1 ether;
        return reward;
    }

    // Allows users to claim their generated PLAY tokens instantly
    function claimYield() public {
        uint256 pendingYield = calculateYield(msg.sender);
        require(pendingYield > 0, "No yield to claim");

        // Reentrancy and time-tracking reset FIRST
        stakes[msg.sender].lastClaimTimestamp = block.timestamp;
        
        // Send the minted play tokens from the vault's reserve to the user
        require(playToken.balanceOf(address(this)) >= pendingYield, "Vault has insufficient PLAY reserve");
        
        emit YieldClaimed(msg.sender, pendingYield);
        playToken.transfer(msg.sender, pendingYield);
    }

    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than zero");

        // Auto-claim existing yield before modifying principal
        if (stakes[msg.sender].amount > 0) {
            uint256 pendingYield = calculateYield(msg.sender);
            if(pendingYield > 0 && playToken.balanceOf(address(this)) >= pendingYield) {
               // Safely distribute yield inline
               stakes[msg.sender].lastClaimTimestamp = block.timestamp;
               emit YieldClaimed(msg.sender, pendingYield);
               playToken.transfer(msg.sender, pendingYield);
            }
        }

        stakes[msg.sender].amount += msg.value;
        stakes[msg.sender].lastClaimTimestamp = block.timestamp;
        totalValueLocked += msg.value;

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 amount = stakes[msg.sender].amount;
        require(amount > 0, "No balance to withdraw");

        // Claim remaining yield before withdrawing
        uint256 pendingYield = calculateYield(msg.sender);
        if(pendingYield > 0 && playToken.balanceOf(address(this)) >= pendingYield) {
            emit YieldClaimed(msg.sender, pendingYield);
            playToken.transfer(msg.sender, pendingYield);
        }

        stakes[msg.sender].amount = 0;
        stakes[msg.sender].lastClaimTimestamp = 0;
        totalValueLocked -= amount;

        emit Withdrawn(msg.sender, amount);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }

    // Returns the exact HBAR balance a user has staked
    function balances(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    // ============================================
    // Admin / Treasury Management Functions
    // ============================================

    // Custom admin function to pull HBAR from the contract safely
    function adminWithdrawHbar(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough HBAR in the contract.");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Admin transfer failed");
    }

    // Custom admin function to rescue PLAY tokens or sweep excess reserves
    function adminWithdrawPlay(uint256 amount) external onlyOwner {
        require(playToken.balanceOf(address(this)) >= amount, "Not enough PLAY in the contract.");
        playToken.transfer(owner(), amount);
    }
}
