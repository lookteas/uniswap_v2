// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Faucet
 * @dev 测试代币水龙头合约
 * 
 * 功能:
 * - 用户可以一次性领取多种测试代币
 * - 每个地址只能领取一次
 * - Owner 可以配置代币列表和领取数量
 * - Owner 可以重置用户领取状态
 * - Owner 可以提取合约中的代币
 */
contract Faucet is Ownable {
    // 每种代币的领取数量 (默认 1000 * 10^18)
    uint256 public claimAmount = 1000 * 10**18;
    
    // 支持的代币列表
    address[] public tokens;
    
    // 记录用户是否已领取
    mapping(address => bool) public hasClaimed;
    
    // 事件
    event TokensClaimed(address indexed user, uint256 tokenCount, uint256 amountPerToken);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event ClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event ClaimReset(address indexed user);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address[] memory _tokens) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            tokens.push(_tokens[i]);
            emit TokenAdded(_tokens[i]);
        }
    }

    /**
     * @dev 用户领取测试代币
     * 一次性领取所有配置的代币，每种 claimAmount 数量
     */
    function claim() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(tokens.length > 0, "No tokens configured");
        
        hasClaimed[msg.sender] = true;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20 token = IERC20(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            
            if (balance >= claimAmount) {
                require(token.transfer(msg.sender, claimAmount), "Transfer failed");
            }
        }
        
        emit TokensClaimed(msg.sender, tokens.length, claimAmount);
    }

    /**
     * @dev 查询用户是否可以领取
     */
    function canClaim(address user) external view returns (bool) {
        return !hasClaimed[user];
    }

    /**
     * @dev 获取所有支持的代币地址
     */
    function getTokens() external view returns (address[] memory) {
        return tokens;
    }

    /**
     * @dev 获取代币数量
     */
    function getTokenCount() external view returns (uint256) {
        return tokens.length;
    }

    /**
     * @dev 查询合约中某代币的余额
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ============ Owner Functions ============

    /**
     * @dev 添加新代币
     */
    function addToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != token, "Token already exists");
        }
        tokens.push(token);
        emit TokenAdded(token);
    }

    /**
     * @dev 移除代币
     */
    function removeToken(address token) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == token) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                emit TokenRemoved(token);
                return;
            }
        }
        revert("Token not found");
    }

    /**
     * @dev 更新领取数量
     */
    function setClaimAmount(uint256 newAmount) external onlyOwner {
        require(newAmount > 0, "Amount must be greater than 0");
        uint256 oldAmount = claimAmount;
        claimAmount = newAmount;
        emit ClaimAmountUpdated(oldAmount, newAmount);
    }

    /**
     * @dev 重置用户领取状态（允许再次领取）
     */
    function resetClaim(address user) external onlyOwner {
        hasClaimed[user] = false;
        emit ClaimReset(user);
    }

    /**
     * @dev 批量重置用户领取状态
     */
    function batchResetClaim(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            hasClaimed[users[i]] = false;
            emit ClaimReset(users[i]);
        }
    }

    /**
     * @dev 提取合约中的代币
     */
    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).transfer(to, amount);
        emit TokensWithdrawn(token, to, amount);
    }

    /**
     * @dev 提取合约中某代币的全部余额
     */
    function withdrawAllToken(address token, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(to, balance);
            emit TokensWithdrawn(token, to, balance);
        }
    }
}
