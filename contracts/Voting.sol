// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/// @title FaraToken (ERC-20)
/// @notice ERC-20 token with minting, burning, pausable transfers, and a supply cap
contract FaraToken is ERC20, ERC20Capped, ERC20Pausable, Ownable {
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    constructor(
        uint256 initialSupply,
        uint256 cap_
    ) ERC20("FaraToken", "FARA") ERC20Capped(cap_) Ownable(msg.sender) {
        require(cap_ > 0, "Cap must be > 0");
        require(initialSupply <= cap_, "Initial supply exceeds cap");
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Not enough balance");
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        require(amount > 0, "Amount must be > 0");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(amount > 0, "Amount must be > 0");
        return super.transferFrom(from, to, amount);
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
