# Uniswap V2 - Foundry 部署项目

基于 Foundry 的 Uniswap V2 合约部署项目，支持本地测试和 Sepolia 测试网部署。

## 项目结构

```
├── src/
│   ├── v2-core/          # Uniswap V2 核心合约 (Solidity 0.5.16)
│   ├── v2-periphery/     # Uniswap V2 外围合约 (Solidity 0.6.6)
│   ├── Permit2Router.sol # Permit2 包装合约
│   ├── TestToken.sol     # 测试代币 (支持 ERC-2612 Permit)
│   └── WETH9.sol         # WETH 合约 (本地测试用)
├── script/
│   ├── DeployUniswapV2.s.sol       # 完整部署脚本
│   ├── DeployPermit2Router.s.sol   # Permit2Router 部署脚本
│   ├── DeployTokens.s.sol          # 测试代币部署脚本
│   ├── 01_DeployFactory.s.sol      # 分步部署 - Factory
│   ├── 02_DeployRouter.s.sol       # 分步部署 - Router
│   └── 03_DeployWETH.s.sol         # 分步部署 - WETH
├── frontend/                        # React 前端应用
│   └── src/
│       ├── components/
│       │   ├── AddLiquidity.tsx         # 添加流动性 (ERC-2612 Permit)
│       │   ├── AddLiquidityPermit2.tsx  # 添加流动性 (Permit2)
│       │   ├── MultiHopSwap.tsx         # 多跳兑换 (传统模式)
│       │   ├── SwapPermit2.tsx          # 多跳兑换 (Permit2)
│       │   ├── RemoveLiquidity.tsx      # 移除流动性
│       │   ├── RemoveLiquidityPermit2.tsx # 移除流动性 (Permit2)
│       │   ├── TokenBalance.tsx         # 代币余额/LP/池子储备
│       │   └── ConnectWallet.tsx        # 钱包连接 + 水龙头 + WETH
│       ├── hooks/
│       │   └── usePathFinder.ts         # 多跳路径查找 (支持4跳)
│       └── config/
│           ├── contracts.ts   # 合约地址和 ABI
│           └── tokens.ts      # 代币配置 (含 WETH)
├── docs/
│   ├── DEBUG_ADDLIQUIDITY.md  # 调试记录
│   └── PERMIT2.md             # Permit2 集成文档
├── test/
│   └── UniswapV2.t.sol        # 集成测试
├── DEPLOYMENT.md              # 详细部署文档
└── foundry.toml               # Foundry 配置
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
| Permit2Router | `0x23F77d19fA26514C8053958ca8cD95FF73D22372` |

### 测试代币

| 代币 | 地址 |
|------|------|
| WETH | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` |
| TKA | `0x89349c29eAb08674Ccb243aEf113c28847fB5215` |
| TKB | `0x92e90F895172CDc96BB0985BC56f0cA4874aEd79` |
| TKC | `0x7Ca1a37CD0dE6f2bf06c09Da57bEa14344BfBa25` |
| TKD | `0x4dDCabc42aAF3403e300413F3b8AD909F58785b1` |
| TKE | `0xC479b9504E6B70e7cfD8C6479d83D9b5b0883c6` |

### 辅助合约

| 合约 | 地址 |
|------|------|
| Faucet | `0xf641f31d368B61F366672EB88F3a033ACC5DD27d` |

**Init Code Hash**: `0x25aad938d8616b6e59148d3e701e4966de4418a752233589352d7c616a256568`

> ⚠️ 注意：`UniswapV2Library.sol` 中的 init code hash 已更新为上述值。

## 详细文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 完整的部署和测试指南
- [docs/PERMIT2.md](./docs/PERMIT2.md) - Permit2 集成文档
- [frontend/README.md](./frontend/README.md) - 前端功能文档
- [docs/DEBUG_ADDLIQUIDITY.md](./docs/DEBUG_ADDLIQUIDITY.md) - 调试记录

## Foundry 命令参考

```bash
forge build          # 编译
forge test           # 测试
forge test -vvvv     # 详细测试输出
anvil                # 启动本地节点
```
