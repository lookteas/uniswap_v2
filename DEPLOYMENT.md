# Uniswap V2 部署与测试文档

本文档详细说明如何使用 Foundry 在本地和 Sepolia 测试网上部署 Uniswap V2 合约。

> ✅ **已验证**: 本文档中的所有命令已在 2025-12-01 成功执行并通过测试。

---

## 目录

1. [项目概述](#1-项目概述)
2. [前置准备](#2-前置准备)
3. [项目配置](#3-项目配置)
4. [本地部署](#4-本地部署)
5. [Sepolia 测试网部署](#5-sepolia-测试网部署)
6. [功能测试](#6-功能测试)
7. [合约验证](#7-合约验证)
8. [常见问题](#8-常见问题)
9. [部署记录](#9-部署记录)

---

## 1. 项目概述

### 核心合约

| 合约 | 路径 | Solidity 版本 | 说明 |
|------|------|---------------|------|
| `UniswapV2Factory` | `src/v2-core/contracts/` | 0.5.16 | 工厂合约，用于创建交易对 |
| `UniswapV2Pair` | `src/v2-core/contracts/` | 0.5.16 | 交易对合约（由 Factory 自动部署） |
| `UniswapV2Router02` | `src/v2-periphery/contracts/` | 0.6.6 | 路由合约，提供用户交互接口 |

### 部署顺序

```
1. 部署 WETH（本地需要，Sepolia 使用已有地址）
2. 部署 UniswapV2Factory
3. 更新 init code hash（重要！）
4. 部署 UniswapV2Router02
```

### Init Code Hash 说明

⚠️ **重要**: `UniswapV2Library.sol` 中硬编码了 Pair 合约的 init code hash，用于计算交易对地址。如果使用 Foundry 编译，hash 值会与原版不同，**必须更新**。

当前项目的 init code hash:
```
0x25aad938d8616b6e59148d3e701e4966de4418a752233589352d7c616a256568
```

原版 Uniswap V2 的 hash:
```
0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f
```

---

## 2. 前置准备

### 2.1 安装 Foundry

```bash
# Windows (使用 foundryup)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 验证安装
forge --version
cast --version
anvil --version
```

### 2.2 环境变量配置

复制 `.env.example` 为 `.env` 并填入你的值：

```bash
# 私钥（可以包含 0x 前缀）
PRIVATE_KEY=0xyour_private_key_here

# Sepolia RPC URL（可使用 Alchemy、Infura 等）
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-api-key

# Etherscan API Key（用于合约验证）
ETHERSCAN_API_KEY=your_etherscan_api_key
```

> ⚠️ **安全提示**：
> - `.env` 已添加到 `.gitignore`
> - 永远不要在公开仓库中暴露私钥
> - 测试网使用专门的测试钱包

### 2.3 获取 Sepolia 测试币

- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)
- [Google Cloud Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)

---

## 3. 项目配置

### 3.1 初始化 Git（如果尚未初始化）

```bash
git init
```

### 3.2 编译合约

```bash
forge build
```

> 注意：`lib/solidity-lib` 目录已包含必要的依赖文件，无需额外安装。

---

## 4. 本地部署

### 4.1 启动本地节点

```bash
# 在新终端窗口启动 Anvil
anvil
```

Anvil 默认配置：
- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`
- 默认私钥: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- 默认账户: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### 4.2 部署合约（已验证命令）

```bash
# Step 1: 部署 WETH
forge create src/WETH9.sol:WETH9 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

# Step 2: 部署 Factory（将 constructor-args 替换为你的地址）
forge create src/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast \
  --constructor-args 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Step 3: 部署 Router（替换 FACTORY_ADDRESS 和 WETH_ADDRESS）
forge create src/v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02 \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast \
  --constructor-args <FACTORY_ADDRESS> <WETH_ADDRESS>
```

### 4.3 验证部署

```bash
# 查询 Router 的 factory 地址
cast call <ROUTER_ADDRESS> "factory()(address)" --rpc-url http://127.0.0.1:8545

# 查询 Router 的 WETH 地址
cast call <ROUTER_ADDRESS> "WETH()(address)" --rpc-url http://127.0.0.1:8545
```

---

## 5. Sepolia 测试网部署

### 5.1 已知地址

| 合约 | 地址 |
|------|------|
| WETH (Sepolia) | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` |

### 5.2 部署命令（已验证）

以下是实际执行成功的部署命令：

```bash
# Step 1: 部署 Factory
forge create src/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast \
  --constructor-args <YOUR_ADDRESS>

# Step 2: 部署 Router
forge create src/v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02 \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast \
  --constructor-args <FACTORY_ADDRESS> 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
```

### 5.3 验证部署

```bash
# 验证 Router 配置
cast call <ROUTER_ADDRESS> "factory()(address)" \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY>

cast call <ROUTER_ADDRESS> "WETH()(address)" \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY>
```

---

## 6. 功能测试（已验证）

以下是在 Sepolia 上实际执行成功的完整测试流程。

### 6.1 部署测试代币

```bash
# 部署 Token A (1,000,000 个)
forge create src/TestToken.sol:TestToken \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast \
  --constructor-args "Token A" "TKA" 1000000000000000000000000

# 部署 Token B (1,000,000 个)
forge create src/TestToken.sol:TestToken \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast \
  --constructor-args "Token B" "TKB" 1000000000000000000000000
```

### 6.2 创建交易对

```bash
# 通过 Factory 创建交易对
cast send <FACTORY_ADDRESS> \
  "createPair(address,address)" \
  <TOKEN_A_ADDRESS> <TOKEN_B_ADDRESS> \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY>

# 查询交易对地址
cast call <FACTORY_ADDRESS> \
  "getPair(address,address)(address)" \
  <TOKEN_A_ADDRESS> <TOKEN_B_ADDRESS> \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY>
```

### 6.3 授权代币

```bash
# 授权 Router 使用 Token A (授权大额度)
cast send <TOKEN_A_ADDRESS> \
  "approve(address,uint256)" \
  <ROUTER_ADDRESS> 1000000000000000000000000 \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY>

# 授权 Router 使用 Token B
cast send <TOKEN_B_ADDRESS> \
  "approve(address,uint256)" \
  <ROUTER_ADDRESS> 1000000000000000000000000 \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY>
```

### 6.4 添加流动性

```bash
# 添加 100 Token A + 100 Token B 的流动性
# deadline 使用一个足够大的时间戳 (9999999999)
cast send <ROUTER_ADDRESS> \
  "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  <TOKEN_A_ADDRESS> \
  <TOKEN_B_ADDRESS> \
  100000000000000000000 \
  100000000000000000000 \
  0 \
  0 \
  <YOUR_ADDRESS> \
  9999999999 \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY>
```

### 6.5 执行 Swap

```bash
# 用 1 个 Token A 换 Token B
cast send <ROUTER_ADDRESS> \
  "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" \
  1000000000000000000 \
  0 \
  "[<TOKEN_A_ADDRESS>,<TOKEN_B_ADDRESS>]" \
  <YOUR_ADDRESS> \
  9999999999 \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY> \
  --private-key <YOUR_PRIVATE_KEY>
```

### 6.6 查询余额

```bash
# 查询 Token B 余额
cast call <TOKEN_B_ADDRESS> \
  "balanceOf(address)(uint256)" \
  <YOUR_ADDRESS> \
  --rpc-url https://sepolia.infura.io/v3/<YOUR_API_KEY>
```

---

## 7. 合约验证

### 7.1 部署时自动验证

```bash
forge create ... \
  --verify \
  --etherscan-api-key <YOUR_ETHERSCAN_API_KEY>
```

### 7.2 手动验证

```bash
# 验证 Factory
forge verify-contract <FACTORY_ADDRESS> \
  src/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(address)" <FEE_TO_SETTER>) \
  --etherscan-api-key <YOUR_ETHERSCAN_API_KEY>

# 验证 Router
forge verify-contract <ROUTER_ADDRESS> \
  src/v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02 \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address)" <FACTORY> <WETH>) \
  --etherscan-api-key <YOUR_ETHERSCAN_API_KEY>
```

---

## 8. 常见问题

### Q1: Init Code Hash 不匹配（最常见问题）

**症状**: `addLiquidity` 或 `swap` 交易失败，无明确错误信息。

**原因**: Router 中的 `UniswapV2Library.sol` 硬编码了 init code hash，与实际编译的 Pair 合约不匹配。

**解决方案**:

1. 计算当前 Pair 的 init code hash:
```bash
forge inspect src/v2-core/contracts/UniswapV2Pair.sol:UniswapV2Pair bytecode > pair_bytecode.txt
```

2. 在 PowerShell 中计算 hash:
```powershell
$bytecode = (Get-Content pair_bytecode.txt -Raw).Trim()
if (-not $bytecode.StartsWith("0x")) { $bytecode = "0x" + $bytecode }
cast keccak256 $bytecode
```

3. 更新 `src/v2-periphery/contracts/libraries/UniswapV2Library.sol` 第 24 行:
```solidity
hex'25aad938d8616b6e59148d3e701e4966de4418a752233589352d7c616a256568' // init code hash
```

4. 重新编译并部署 Router。

### Q2: 交易过期 (EXPIRED)

**症状**: 错误信息 `UniswapV2Router: EXPIRED`

**解决方案**: 使用更大的 deadline 值，如 `9999999999`

### Q3: Windows PowerShell 环境变量

```powershell
# 方式一：直接设置
$env:PRIVATE_KEY = "0x..."
$env:SEPOLIA_RPC_URL = "https://..."

# 方式二：从 .env 文件加载
$envContent = Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^#' }
foreach ($line in $envContent) {
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
    }
}
```

### Q4: Gas 不足

```bash
forge create ... --gas-limit 500000
```

---

## 9. 部署记录

### Sepolia 测试网部署 (2024-12-01) ✅

| 合约 | 地址 | 状态 |
|------|------|------|
| Factory | `0x9A267db279FE7d11138f9293784460Df577c3198` | ✅ 已部署 |
| Router | `0x3c66Fe68778281be4358F21BfB63aE9cD242aB58` | ✅ 已部署 |
| WETH | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` | (已有) |
| Token A (测试) | `0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd` | ✅ 已部署 |
| Token B (测试) | `0x64e6775b20Ed22ec10bca887400E6F5790112e75` | ✅ 已部署 |
| Pair (TKA/TKB) | `0xF3efCad26af4AA64F2eE7a99f2051b45e9057040` | ✅ 已创建 |

**Init Code Hash**: `0x25aad938d8616b6e59148d3e701e4966de4418a752233589352d7c616a256568`

**测试结果**:
- ✅ 创建交易对成功
- ✅ 添加流动性成功 (100 TKA + 100 TKB)
- ✅ Swap 成功 (1 TKA → ~0.987 TKB)

**Etherscan 链接**:
- Factory: https://sepolia.etherscan.io/address/0x9A267db279FE7d11138f9293784460Df577c3198
- Router: https://sepolia.etherscan.io/address/0x3c66Fe68778281be4358F21BfB63aE9cD242aB58

---

## 附录：部署检查清单

### 部署前

- [ ] Foundry 已安装 (`forge --version`)
- [ ] `.env` 配置正确
- [ ] 钱包有足够的 ETH
- [ ] `UniswapV2Library.sol` 的 init code hash 已更新

### 部署后

- [ ] Factory 已部署
- [ ] Router 已部署
- [ ] `Router.factory()` 返回正确的 Factory 地址
- [ ] `Router.WETH()` 返回正确的 WETH 地址
- [ ] 创建交易对成功
- [ ] 添加流动性成功
- [ ] Swap 功能正常
