# 多交易对 + 多跳 Swap 实现指南

本文档说明如何部署多个交易对并实现多跳 Swap 功能。

---

## 目录

1. [概念说明](#1-概念说明)
2. [部署新代币](#2-部署新代币)
3. [创建交易对](#3-创建交易对)
4. [添加流动性](#4-添加流动性)
5. [多跳 Swap 原理](#5-多跳-swap-原理)
6. [前端配置](#6-前端配置)
7. [完整示例](#7-完整示例)

---

## 1. 概念说明

### 什么是多跳 Swap？

当两个代币之间没有直接的交易对时，可以通过中间代币进行多次兑换：

```
直接路径:  TKA → TKB (1 跳)
多跳路径:  TKA → TKC → TKB (2 跳)
多跳路径:  TKA → TKC → TKD → TKB (3 跳)
```

### 为什么需要多跳？

1. **没有直接交易对**: TKA/TKB 交易对不存在
2. **更优价格**: 通过中间代币可能获得更好的兑换率
3. **流动性分散**: 不同路径的流动性深度不同

### Uniswap V2 Router 如何处理多跳？

`swapExactTokensForTokens` 函数接受一个 `path` 数组：

```solidity
function swapExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    address[] calldata path,  // [tokenIn, ..., tokenOut]
    address to,
    uint deadline
) external returns (uint[] memory amounts);
```

- `path = [TKA, TKB]` → 1 跳
- `path = [TKA, TKC, TKB]` → 2 跳
- `path = [TKA, TKC, TKD, TKB]` → 3 跳

---

## 2. 部署新代币

### 2.1 设置环境变量

```powershell
# PowerShell
$env:SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/YOUR_API_KEY"
$env:PRIVATE_KEY = "0x..."
```

### 2.2 部署 Token C

```bash
forge create src/TestToken.sol:TestToken \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args "Token C" "TKC" 1000000000000000000000000
```

记录输出的合约地址：`TKC_ADDRESS=0x...`

### 2.3 部署 Token D

```bash
forge create src/TestToken.sol:TestToken \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args "Token D" "TKD" 1000000000000000000000000
```

记录输出的合约地址：`TKD_ADDRESS=0x...`

---

## 3. 创建交易对

### 已有合约地址

| 合约 | 地址 |
|------|------|
| Factory | `0x9A267db279FE7d11138f9293784460Df577c3198` |
| Router | `0x3c66Fe68778281be4358F21BfB63aE9cD242aB58` |
| TKA | `0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd` |
| TKB | `0x64e6775b20Ed22ec10bca887400E6F5790112e75` |

### 3.1 创建 TKA/TKC 交易对

```bash
cast send 0x9A267db279FE7d11138f9293784460Df577c3198 \
  "createPair(address,address)" \
  0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd \
  <TKC_ADDRESS> \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3.2 创建 TKC/TKB 交易对

```bash
cast send 0x9A267db279FE7d11138f9293784460Df577c3198 \
  "createPair(address,address)" \
  <TKC_ADDRESS> \
  0x64e6775b20Ed22ec10bca887400E6F5790112e75 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3.3 创建 TKA/TKD 交易对

```bash
cast send 0x9A267db279FE7d11138f9293784460Df577c3198 \
  "createPair(address,address)" \
  0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd \
  <TKD_ADDRESS> \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3.4 创建 TKD/TKB 交易对

```bash
cast send 0x9A267db279FE7d11138f9293784460Df577c3198 \
  "createPair(address,address)" \
  <TKD_ADDRESS> \
  0x64e6775b20Ed22ec10bca887400E6F5790112e75 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 3.5 查询交易对地址

```bash
# 查询 TKA/TKC 交易对地址
cast call 0x9A267db279FE7d11138f9293784460Df577c3198 \
  "getPair(address,address)(address)" \
  0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd \
  <TKC_ADDRESS> \
  --rpc-url $SEPOLIA_RPC_URL
```

---

## 4. 添加流动性

每个交易对都需要添加流动性才能进行 Swap。

### 4.1 授权代币

```bash
# 授权 TKC 给 Router
cast send <TKC_ADDRESS> \
  "approve(address,uint256)" \
  0x3c66Fe68778281be4358F21BfB63aE9cD242aB58 \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# 授权 TKD 给 Router
cast send <TKD_ADDRESS> \
  "approve(address,uint256)" \
  0x3c66Fe68778281be4358F21BfB63aE9cD242aB58 \
  115792089237316195423570985008687907853269984665640564039457584007913129639935 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 4.2 为 TKA/TKC 添加流动性

```bash
cast send 0x3c66Fe68778281be4358F21BfB63aE9cD242aB58 \
  "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd \
  <TKC_ADDRESS> \
  50000000000000000000 \
  50000000000000000000 \
  0 \
  0 \
  <YOUR_ADDRESS> \
  9999999999 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 4.3 为 TKC/TKB 添加流动性

```bash
cast send 0x3c66Fe68778281be4358F21BfB63aE9cD242aB58 \
  "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  <TKC_ADDRESS> \
  0x64e6775b20Ed22ec10bca887400E6F5790112e75 \
  50000000000000000000 \
  50000000000000000000 \
  0 \
  0 \
  <YOUR_ADDRESS> \
  9999999999 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

重复上述步骤为其他交易对添加流动性。

---

## 5. 多跳 Swap 原理

### 5.1 路径计算

Router 的 `getAmountsOut` 函数可以计算多跳路径的输出：

```bash
# 计算 TKA → TKC → TKB 的输出
cast call 0x3c66Fe68778281be4358F21BfB63aE9cD242aB58 \
  "getAmountsOut(uint256,address[])(uint256[])" \
  1000000000000000000 \
  "[0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd,<TKC_ADDRESS>,0x64e6775b20Ed22ec10bca887400E6F5790112e75]" \
  --rpc-url $SEPOLIA_RPC_URL
```

返回值是每一跳的输出金额数组：`[amountIn, amount1, amount2, ...]`

### 5.2 执行多跳 Swap

```bash
# 执行 TKA → TKC → TKB 多跳 Swap
cast send 0x3c66Fe68778281be4358F21BfB63aE9cD242aB58 \
  "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" \
  1000000000000000000 \
  0 \
  "[0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd,<TKC_ADDRESS>,0x64e6775b20Ed22ec10bca887400E6F5790112e75]" \
  <YOUR_ADDRESS> \
  9999999999 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 5.3 最优路径选择

比较不同路径的输出，选择最优：

```
路径 1: TKA → TKB (直接)     → 输出: 0.98 TKB
路径 2: TKA → TKC → TKB      → 输出: 0.99 TKB  ← 最优
路径 3: TKA → TKD → TKB      → 输出: 0.97 TKB
```

---

## 6. 前端配置

### 6.1 添加新代币到配置

编辑 `frontend/src/config/tokens.ts`：

```typescript
export const TOKENS: Token[] = [
  {
    address: '0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd',
    symbol: 'TKA',
    name: 'Token A',
    decimals: 18,
  },
  {
    address: '0x64e6775b20Ed22ec10bca887400E6F5790112e75',
    symbol: 'TKB',
    name: 'Token B',
    decimals: 18,
  },
  // 添加新代币
  {
    address: '<TKC_ADDRESS>',
    symbol: 'TKC',
    name: 'Token C',
    decimals: 18,
  },
  {
    address: '<TKD_ADDRESS>',
    symbol: 'TKD',
    name: 'Token D',
    decimals: 18,
  },
];
```

### 6.2 使用多跳 Swap 组件

前端已添加"多跳"选项卡，支持：

1. **自动路径发现**: 自动查找所有可能的路径
2. **最优路径推荐**: 按输出金额排序，标记最优路径
3. **手动路径选择**: 用户可以选择非最优路径
4. **多跳显示**: 显示路径跳数和中间代币

---

## 7. 完整示例

### 场景：创建 4 个代币的多路径网络

```
     TKA -------- TKB
      |  \      /  |
      |   \    /   |
      |    \  /    |
     TKC -------- TKD
```

### 7.1 部署代币

```bash
# TKA, TKB 已存在

# 部署 TKC
forge create src/TestToken.sol:TestToken \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args "Token C" "TKC" 1000000000000000000000000

# 部署 TKD
forge create src/TestToken.sol:TestToken \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args "Token D" "TKD" 1000000000000000000000000
```

### 7.2 创建所有交易对

```bash
# TKA/TKB (已存在)
# TKA/TKC
# TKA/TKD
# TKB/TKC
# TKB/TKD
# TKC/TKD
```

### 7.3 添加流动性

为每个交易对添加不同比例的流动性，模拟真实市场：

| 交易对 | 流动性 | 价格 |
|--------|--------|------|
| TKA/TKB | 100/100 | 1:1 |
| TKA/TKC | 100/200 | 1:2 |
| TKC/TKB | 200/100 | 2:1 |
| TKA/TKD | 100/50 | 2:1 |
| TKD/TKB | 50/100 | 1:2 |

### 7.4 测试多跳

用 1 TKA 兑换 TKB，比较路径：

```
TKA → TKB (直接):        ~0.99 TKB
TKA → TKC → TKB:         ~0.98 TKB
TKA → TKD → TKB:         ~0.97 TKB
TKA → TKC → TKD → TKB:   ~0.96 TKB
```

---

## 注意事项

1. **Gas 费用**: 多跳路径消耗更多 Gas
2. **滑点累积**: 每一跳都有滑点，多跳会累积
3. **路径验证**: 确保每个中间交易对都有足够流动性
4. **最大跳数**: 建议不超过 3 跳，避免过高 Gas 和滑点

---

## 相关文件

- `frontend/src/components/MultiHopSwap.tsx` - 多跳 Swap 组件
- `frontend/src/hooks/usePathFinder.ts` - 路径查找逻辑
- `frontend/src/config/tokens.ts` - 代币配置
