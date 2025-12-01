# Uniswap V2 - Foundry 部署项目

基于 Foundry 的 Uniswap V2 合约部署项目，支持本地测试和 Sepolia 测试网部署。

## 项目结构

```
├── src/
│   ├── v2-core/          # Uniswap V2 核心合约 (Solidity 0.5.16)
│   ├── v2-periphery/     # Uniswap V2 外围合约 (Solidity 0.6.6)
│   └── WETH9.sol         # WETH 合约 (本地测试用)
├── script/
│   ├── DeployUniswapV2.s.sol    # 完整部署脚本
│   ├── 01_DeployFactory.s.sol   # 分步部署 - Factory
│   ├── 02_DeployRouter.s.sol    # 分步部署 - Router
│   └── 03_DeployWETH.s.sol      # 分步部署 - WETH
├── test/
│   └── UniswapV2.t.sol          # 集成测试
├── DEPLOYMENT.md                 # 详细部署文档
└── foundry.toml                  # Foundry 配置
```

## 快速开始

### 1. 安装依赖

```bash
forge install Uniswap/solidity-lib --no-commit
```

### 2. 编译

```bash
forge build
```

### 3. 运行测试

```bash
forge test -vvv
```

### 4. 本地部署

```bash
# 启动本地节点
anvil

# 新终端执行部署
forge script script/DeployUniswapV2.s.sol:DeployUniswapV2 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast
```

### 5. Sepolia 部署

```bash
# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的私钥和 RPC URL

# 部署
forge script script/DeployUniswapV2.s.sol:DeployUniswapV2 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

## 核心合约

| 合约 | 说明 |
|------|------|
| `UniswapV2Factory` | 工厂合约，创建交易对 |
| `UniswapV2Pair` | 交易对合约（由 Factory 自动部署） |
| `UniswapV2Router02` | 路由合约，用户交互入口 |

## Swap 交易流程

下图展示了 Uniswap V2 从 Router02 到 Pair 合约的完整 swap 机制：

<img src="./images/swap_flow.png" alt="Uniswap V2 Swap Flow" style="zoom:80%;" />

**流程概述：**
1. 用户调用 `swapExactTokensForTokens()` 发起交易
2. Router 通过 `getAmountsOut()` 计算每一跳的输出金额
3. 输入代币被转移到第一个 Pair 合约
4. Pair 合约执行乐观转账、验证 K 常数、更新储备量
5. 多跳交易时，输出代币自动流向下一个 Pair，直到最终到达用户钱包

## Sepolia 部署地址 (已验证 ✅)

| 合约 | 地址 |
|------|------|
| Factory | `0x9A267db279FE7d11138f9293784460Df577c3198` |
| Router | `0x3c66Fe68778281be4358F21BfB63aE9cD242aB58` |
| WETH | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` |

**Init Code Hash**: `0x25aad938d8616b6e59148d3e701e4966de4418a752233589352d7c616a256568`

> ⚠️ 注意：`UniswapV2Library.sol` 中的 init code hash 已更新为上述值。

## 详细文档

详细部署文档请查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 获取完整的部署和测试指南。

## Foundry 命令参考

```bash
forge build          # 编译
forge test           # 测试
forge test -vvvv     # 详细测试输出
anvil                # 启动本地节点
```
