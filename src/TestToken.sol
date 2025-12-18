// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken
 * @dev 生产级 ERC20 代币实现，基于 OpenZeppelin 4.9.6 标准库
 * 
 * 功能特性:
 * - ERC20 标准实现
 * - ERC20Permit (EIP-2612): 支持签名授权，无需链上 approve 交易
 * - ERC20Burnable: 支持代币销毁
 * - Ownable: 所有权管理，支持铸造新代币
 * 
 * 适用于:
 * - Uniswap V2/V3 流动性池
 * - 任何标准 DeFi 协议
 */
contract TestToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    /// @notice 代币精度，固定为 18
    uint8 private constant _DECIMALS = 18;

    /// @notice 最大供应量上限 (可选，设为 0 表示无上限)
    uint256 public immutable maxSupply;

    /// @notice 铸造事件
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @dev 构造函数
     * @param name_ 代币名称
     * @param symbol_ 代币符号
     * @param initialSupply_ 初始供应量 (以最小单位计算，即 wei)
     * @param maxSupply_ 最大供应量上限，设为 0 表示无上限
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        uint256 maxSupply_
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
        require(maxSupply_ == 0 || initialSupply_ <= maxSupply_, "Initial supply exceeds max supply");
        maxSupply = maxSupply_;
        
        if (initialSupply_ > 0) {
            _mint(msg.sender, initialSupply_);
            emit TokensMinted(msg.sender, initialSupply_);
        }
    }

    /**
     * @dev 返回代币精度
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @dev 铸造新代币，仅限所有者调用
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        if (maxSupply > 0) {
            require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        }
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev 批量转账，节省 gas
     * @param recipients 接收地址数组
     * @param amounts 转账金额数组
     */
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length <= 100, "Too many recipients");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot transfer to zero address");
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
    }

    /**
     * @dev 检查代币是否支持 Permit (EIP-2612)
     * @return 始终返回 true
     */
    function supportsPermit() external pure returns (bool) {
        return true;
    }
}
