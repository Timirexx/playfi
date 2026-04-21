// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlayToken is ERC20, Ownable {
    constructor() ERC20("PlayFi Token", "PLAY") Ownable(msg.sender) {
        // Mint an initial supply of 10,000,000 PLAY tokens to the treasury
        _mint(msg.sender, 10000000 * 10 ** decimals());
    }

    // Advanced: Allows the Vault to mint more PLAY dynamically if the initial supply runs out. 
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
