import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, ROUTER_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';
import { usePathFinder, formatPath } from '../hooks/usePathFinder';

export function MultiHopSwap() {
  const { address } = useAccount();
  const [amountIn, setAmountIn] = useState('');
  const [tokenInIndex, setTokenInIndex] = useState(0);
  const [tokenOutIndex, setTokenOutIndex] = useState(1);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [slippage, setSlippage] = useState(0.5);
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);
  const [showSettings, setShowSettings] = useState(false);

  const tokenIn = TOKENS[tokenInIndex];
  const tokenOut = TOKENS[tokenOutIndex];

  // 使用路径查找 Hook
  const { paths, bestPath, isLoading: isLoadingPaths } = usePathFinder(
    tokenIn,
    tokenOut,
    amountIn
  );

  // 当前选择的路径
  const selectedPath = paths[selectedPathIndex] || bestPath;

  // 查询授权额度
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, CONTRACTS.ROUTER],
    query: { enabled: !!address && !!tokenIn },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const amountInWei = amountIn ? parseUnits(amountIn, 18) : BigInt(0);
  const allowanceValue = (allowance as bigint) ?? BigInt(0);
  const needsApproval = allowanceValue < amountInWei;

  // 切换代币
  const handleSwapTokens = () => {
    setTokenInIndex(tokenOutIndex);
    setTokenOutIndex(tokenInIndex);
    setSelectedPathIndex(0);
  };

  const handleApprove = () => {
    writeContract({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleSwap = () => {
    if (!amountIn || !address || !selectedPath) return;

    const minOut = (selectedPath.amountOut * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

    writeContract({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [amountInWei, minOut, selectedPath.addresses, address, deadline],
    });
  };

  const estimatedOutput = selectedPath?.amountOut 
    ? formatUnits(selectedPath.amountOut, 18) 
    : '0';

  return (
    <div className="card">
      <div className="card-header">
        <h3>🔄 Swap</h3>
        <button 
          className="settings-btn" 
          onClick={() => setShowSettings(!showSettings)}
          title="设置"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <div className="settings-item">
            <label>滑点容忍度</label>
            <div className="slippage-options">
              {[0.1, 0.5, 1.0].map((val) => (
                <button
                  key={val}
                  className={`slippage-btn ${slippage === val ? 'active' : ''}`}
                  onClick={() => setSlippage(val)}
                >
                  {val}%
                </button>
              ))}
              <div className="slippage-custom">
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                  min="0.1"
                  max="50"
                  step="0.1"
                />
                <span>%</span>
              </div>
            </div>
          </div>
          <div className="settings-item">
            <label>交易截止时间</label>
            <div className="deadline-input">
              <input
                type="number"
                value={deadlineMinutes}
                onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                min="1"
                max="180"
              />
              <span>分钟</span>
            </div>
          </div>
        </div>
      )}

      <div className="swap-container">
        {/* 输入代币选择 */}
        <div className="input-group">
          <label>输入代币</label>
          <div className="input-row">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => {
                setAmountIn(e.target.value);
                setSelectedPathIndex(0);
              }}
              placeholder="0.0"
              min="0"
              step="0.1"
            />
            <select 
              value={tokenInIndex} 
              onChange={(e) => {
                const newIndex = Number(e.target.value);
                if (newIndex === tokenOutIndex) {
                  setTokenOutIndex(tokenInIndex);
                }
                setTokenInIndex(newIndex);
                setSelectedPathIndex(0);
              }}
            >
              {TOKENS.map((token, idx) => (
                <option key={token.address} value={idx}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 切换按钮 */}
        <div className="swap-arrow" onClick={handleSwapTokens} style={{ cursor: 'pointer' }}>
          ⇅
        </div>

        {/* 输出代币选择 */}
        <div className="input-group">
          <label>输出代币</label>
          <div className="input-row">
            <div className="output-display" style={{ flex: 1 }}>
              <span className="output-value">
                {isLoadingPaths ? '计算中...' : parseFloat(estimatedOutput).toFixed(6)}
              </span>
            </div>
            <select 
              value={tokenOutIndex} 
              onChange={(e) => {
                const newIndex = Number(e.target.value);
                if (newIndex === tokenInIndex) {
                  setTokenInIndex(tokenOutIndex);
                }
                setTokenOutIndex(newIndex);
                setSelectedPathIndex(0);
              }}
            >
              {TOKENS.map((token, idx) => (
                <option key={token.address} value={idx}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 路径选择 */}
        {paths.length > 0 && (
          <div className="path-selector">
            <label>选择路径 ({paths.length} 条可用)</label>
            <div className="path-list">
              {paths.map((p, idx) => (
                <div
                  key={idx}
                  className={`path-item ${selectedPathIndex === idx ? 'selected' : ''}`}
                  onClick={() => setSelectedPathIndex(idx)}
                >
                  <span className="path-route">{formatPath(p.path)}</span>
                  <span className="path-output">
                    {parseFloat(formatUnits(p.amountOut, 18)).toFixed(6)} {tokenOut.symbol}
                  </span>
                  {idx === 0 && <span className="best-tag">最优</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {paths.length === 0 && amountIn && parseFloat(amountIn) > 0 && !isLoadingPaths && (
          <div className="no-path-warning">
            ⚠️ 没有找到可用的交易路径，请检查交易对是否存在流动性
          </div>
        )}

        <div className="swap-info">
          <p>滑点: {slippage}% | 截止: {deadlineMinutes}分钟</p>
          {selectedPath && (
            <p>路径: {formatPath(selectedPath.path)} ({selectedPath.path.length - 1} 跳)</p>
          )}
        </div>

        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isPending || isConfirming}
            className="btn btn-primary"
          >
            {isPending || isConfirming ? '处理中...' : `授权 ${tokenIn.symbol}`}
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={!amountIn || !selectedPath || isPending || isConfirming}
            className="btn btn-primary"
          >
            {isPending || isConfirming ? '处理中...' : 'Swap'}
          </button>
        )}

        {isSuccess && (
          <div className="success-message">
            ✅ 交易成功!{' '}
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看交易
            </a>
            <button onClick={() => refetchAllowance()} className="btn btn-secondary btn-sm">
              刷新状态
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
