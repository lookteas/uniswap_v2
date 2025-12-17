import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, ROUTER_ABI } from '../config/contracts';

export function Swap() {
  const { address } = useAccount();
  const [amountIn, setAmountIn] = useState('');
  const [tokenIn, setTokenIn] = useState<'A' | 'B'>('A');
  const [slippage] = useState(0.5); // 0.5% slippage

  const tokenInAddress = tokenIn === 'A' ? CONTRACTS.TOKEN_A : CONTRACTS.TOKEN_B;
  const tokenOutAddress = tokenIn === 'A' ? CONTRACTS.TOKEN_B : CONTRACTS.TOKEN_A;

  // 查询授权额度
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenInAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, CONTRACTS.ROUTER],
    query: { enabled: !!address },
  });

  // 查询预估输出
  const { data: amountsOut } = useReadContract({
    address: CONTRACTS.ROUTER,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [
      amountIn ? parseUnits(amountIn, 18) : BigInt(0),
      [tokenInAddress, tokenOutAddress],
    ],
    query: { enabled: !!amountIn && parseFloat(amountIn) > 0 },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const amountInWei = amountIn ? parseUnits(amountIn, 18) : BigInt(0);
  const allowanceValue = (allowance as bigint) ?? BigInt(0);
  const needsApproval = allowanceValue < amountInWei;

  const handleApprove = () => {
    writeContract({
      address: tokenInAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleSwap = () => {
    if (!amountIn || !address) return;

    const expectedOut = amountsOut?.[1] || BigInt(0);
    const minOut = (expectedOut * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

    writeContract({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [amountInWei, minOut, [tokenInAddress, tokenOutAddress], address, deadline],
    });
  };

  const estimatedOutput = amountsOut?.[1] ? formatUnits(amountsOut[1], 18) : '0';

  return (
    <div className="card">
      <h3>🔄 Swap 兑换</h3>

      <div className="swap-container">
        <div className="input-group">
          <label>输入数量</label>
          <div className="input-row">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
            />
            <select value={tokenIn} onChange={(e) => setTokenIn(e.target.value as 'A' | 'B')}>
              <option value="A">TKA</option>
              <option value="B">TKB</option>
            </select>
          </div>
        </div>

        <div className="swap-arrow">↓</div>

        <div className="input-group">
          <label>预估输出</label>
          <div className="output-display">
            <span className="output-value">{parseFloat(estimatedOutput).toFixed(6)}</span>
            <span className="output-token">{tokenIn === 'A' ? 'TKB' : 'TKA'}</span>
          </div>
        </div>

        <div className="swap-info">
          <p>滑点容忍度: {slippage}%</p>
        </div>

        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isPending || isConfirming}
            className="btn btn-primary"
          >
            {isPending || isConfirming ? '处理中...' : `授权 ${tokenIn === 'A' ? 'TKA' : 'TKB'}`}
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={!amountIn || isPending || isConfirming}
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
