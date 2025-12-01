# Uniswap V2 Swap Mechanism: From Router02 to Pair Contract

## 完整流程图

```mermaid
flowchart TB
    subgraph Entry["1. Swap Entry Point"]
        A[用户调用 swapExactTokensForTokens] --> B[getAmountsOut 计算输出]
        B --> C[验证最小输出量]
    end

    subgraph Library["Library Functions"]
        B --> D[getAmountsOut 遍历 path]
        D --> E[getAmountOut 常数积公式]
        E --> F["amountOut = amountInWithFee × reserveOut / (reserveIn × 1000 + amountInWithFee)"]
    end

    subgraph Transfer["2. Token Transfer"]
        C --> G[safeTransferFrom 转移输入代币到 Pair]
        G --> H[调用 _swap 内部函数]
    end

    subgraph SwapLoop["Router _swap Loop"]
        H --> I[遍历 path 中的每个 hop]
        I --> J[获取 input/output tokens]
        J --> K{是否最后一跳?}
        K -->|否| L[recipient = 下一个 Pair]
        K -->|是| M[recipient = 用户钱包]
        L --> N[调用 pair.swap]
        M --> N
    end

    subgraph PairSwap["3. Pair Contract swap()"]
        N --> O[验证 amount0Out 或 amount1Out > 0]
        O --> P[验证流动性充足]
        P --> Q[乐观转账: 先转出代币给 recipient]
        Q --> R[计算实际收到的输入代币]
        R --> S["应用 0.3% 手续费调整"]
        S --> T["验证 K 常数: balance0Adjusted × balance1Adjusted >= reserve0 × reserve1 × 1000²"]
    end

    subgraph Update["4. Reserve Updates"]
        T --> U[_update 更新储备量]
        U --> V[更新 TWAP 价格预言机]
        V --> W[emit Sync 事件]
        W --> X[emit Swap 事件]
    end

    X --> Y{还有下一跳?}
    Y -->|是| I
    Y -->|否| Z[交易完成]

    style A fill:#e1f5fe
    style Z fill:#c8e6c9
    style T fill:#fff3e0
    style F fill:#f3e5f5
```

## 详细流程图 - 按 Trace 分解

### Trace 1: Swap Entry Point and Path Calculation

```mermaid
flowchart LR
    subgraph Router["UniswapV2Router02.sol"]
        A["swapExactTokensForTokens()<br/>Line 224"] --> B["getAmountsOut()<br/>Line 231"]
        B --> C["require amountOutMin<br/>Line 232"]
    end

    subgraph Library["UniswapV2Library.sol"]
        B --> D["getAmountsOut()<br/>Line 64"]
        D --> E["for loop through path<br/>Line 66"]
        E --> F["getAmountOut()<br/>Line 49"]
        F --> G["getReserves()<br/>Line 29"]
        F --> H["sortTokens()<br/>Line 11"]
    end

    style A fill:#bbdefb
    style F fill:#c8e6c9
```

### Trace 2: Token Transfer and Swap Initiation

```mermaid
flowchart TB
    A["swapExactTokensForTokens()<br/>Line 224"] --> B["Calculate amounts"]
    B --> C["Validate minimum output"]
    C --> D["safeTransferFrom()<br/>Line 233<br/>转移代币到第一个 Pair"]
    D --> E["_swap()<br/>Line 236"]
    
    subgraph SwapInternal["_swap() Internal - Line 212"]
        E --> F["Loop: i < path.length - 1<br/>Line 213"]
        F --> G["Get input/output tokens<br/>Line 214"]
        G --> H["Determine recipient<br/>Line 218"]
        H --> I["pair.swap()<br/>Line 219"]
    end

    style D fill:#fff9c4
    style I fill:#ffccbc
```

### Trace 3: Core Pair Contract Swap Logic

```mermaid
flowchart TB
    A["Pair.swap() Entry<br/>Line 159"] --> B{"amount0Out > 0 OR<br/>amount1Out > 0?"}
    B -->|No| X[REVERT: INSUFFICIENT_OUTPUT]
    B -->|Yes| C{"amount < reserve?"}
    C -->|No| Y[REVERT: INSUFFICIENT_LIQUIDITY]
    C -->|Yes| D["Optimistic Transfer<br/>Line 170<br/>_safeTransfer to recipient"]
    
    D --> E["Calculate Input Amounts<br/>Line 176<br/>balance - (reserve - amountOut)"]
    E --> F{"amount0In > 0 OR<br/>amount1In > 0?"}
    F -->|No| Z[REVERT: INSUFFICIENT_INPUT]
    F -->|Yes| G["Fee Adjustment<br/>Line 180<br/>balance × 1000 - amountIn × 3"]
    
    G --> H{"K Validation<br/>Line 182<br/>balance0Adj × balance1Adj >=<br/>reserve0 × reserve1 × 1000²?"}
    H -->|No| W[REVERT: K]
    H -->|Yes| I[Continue to Update]

    style A fill:#e3f2fd
    style D fill:#fff3e0
    style H fill:#ffebee
```

### Trace 4: Reserve Updates and Swap Completion

```mermaid
flowchart TB
    A["K Validation Passed"] --> B["_update()<br/>Line 185"]
    
    subgraph Update["_update() - Line 73"]
        B --> C["Calculate new reserves"]
        C --> D{"timeElapsed > 0 AND<br/>reserves != 0?"}
        D -->|Yes| E["Update price0CumulativeLast<br/>Update price1CumulativeLast<br/>Line 79"]
        D -->|No| F["Skip oracle update"]
        E --> G["reserve0 = balance0<br/>reserve1 = balance1"]
        F --> G
        G --> H["emit Sync()<br/>Line 85"]
    end
    
    H --> I["emit Swap()<br/>Line 186"]
    I --> J{"More hops in path?"}
    J -->|Yes| K["Next pair receives tokens<br/>Continue loop"]
    J -->|No| L["User receives final tokens<br/>Swap Complete ✓"]

    style L fill:#c8e6c9
    style I fill:#e1bee7
```

## 关键代码位置索引

| 步骤 | 文件 | 行号 | 描述 |
|------|------|------|------|
| 入口 | UniswapV2Router02.sol | 224 | swapExactTokensForTokens() |
| 计算 | UniswapV2Router02.sol | 231 | getAmountsOut() |
| 验证 | UniswapV2Router02.sol | 232 | require amountOutMin |
| 转账 | UniswapV2Router02.sol | 233 | safeTransferFrom() |
| 循环 | UniswapV2Router02.sol | 213 | _swap() loop |
| Pair调用 | UniswapV2Router02.sol | 219 | pair.swap() |
| 输出验证 | UniswapV2Pair.sol | 160 | require output > 0 |
| 乐观转账 | UniswapV2Pair.sol | 170 | _safeTransfer() |
| 输入计算 | UniswapV2Pair.sol | 176 | balance change |
| 手续费 | UniswapV2Pair.sol | 180 | 0.3% fee |
| K验证 | UniswapV2Pair.sol | 182 | constant product |
| 更新储备 | UniswapV2Pair.sol | 185 | _update() |
| 事件 | UniswapV2Pair.sol | 186 | emit Swap() |

## 常数积公式

```
amountOut = (amountIn × 997 × reserveOut) / (reserveIn × 1000 + amountIn × 997)
```

其中 `997/1000` 代表扣除 0.3% 手续费后的比例。
