// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Simple interface for the native Hedera Token Service (HTS) precompile.
 */
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int32 responseCode);
}

contract PlayFiVault is Ownable {
    address private constant HTS_PRECOMPILE = address(0x167);
    IERC20 public playToken;
    
    // Reward rate for 8-decimal PLAY token:
    // 1 PLAY token = 100,000,000 units. 
    // 100,000,000 / 86400 seconds = 1157.407...
    uint256 public rewardRatePerSecond = 1157; 
    
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
        
        // Auto-associate the contract with the native HTS token upon deployment
        (bool success, bytes memory result) = HTS_PRECOMPILE.call(
            abi.encodeWithSelector(IHederaTokenService.associateToken.selector, address(this), _playToken)
        );
        int32 responseCode = success ? abi.decode(result, (int32)) : int32(22); // 22 = fail
        // Note: We don't revert if association fails (it might already be associated)
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
        bool success = playToken.transfer(msg.sender, pendingYield);
        require(success, "Yield transfer failed. Are you associated?");
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

    // Manual association call just in case constructor fails or token changes
    function associateVault(address _token) external onlyOwner {
         (bool success, bytes memory result) = HTS_PRECOMPILE.call(
            abi.encodeWithSelector(IHederaTokenService.associateToken.selector, address(this), _token)
        );
        int32 responseCode = success ? abi.decode(result, (int32)) : int32(22);
        require(responseCode == 22 || success, "Manual association failed");
    }

    function adminWithdrawHbar(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough HBAR in the contract.");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Admin transfer failed");
    }

    function adminWithdrawPlay(uint256 amount) external onlyOwner {
        require(playToken.balanceOf(address(this)) >= amount, "Not enough PLAY in the contract.");
        playToken.transfer(owner(), amount);
    }
}
