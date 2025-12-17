import { useState, useEffect } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, ROUTER_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';

export function AddLiquidity() {
  const { address } = useAccount();
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [tokenAIndex, setTokenAIndex] = useState(0);
  const [tokenBIndex, setTokenBIndex] = useState(1);
  const [lastApprovedToken, setLastApprovedToken] = useState<'A' | 'B' | null>(null);

  const tokenA = TOKENS[tokenAIndex];
  const tokenB = TOKENS[tokenBIndex];

  // 查询两个代币的授权额度和余额
  const { data: tokenData, refetch: refetchTokenData } = useReadContracts({
    contracts: [
      {
        address: tokenA?.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, CONTRACTS.ROUTER],
      },
      {
        address: tokenB?.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, CONTRACTS.ROUTER],
      },
      {
        address: tokenA?.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: tokenB?.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
    ],
    query: { enabled: !!address && !!tokenA && !!tokenB },
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // 授权成功后自动刷新
  useEffect(() => {
    if (isSuccess && lastApprovedToken) {
      refetchTokenData();
      reset();
      setLastApprovedToken(null);
    }
  }, [isSuccess, lastApprovedToken, refetchTokenData, reset]);

  const amountAWei = amountA ? parseUnits(amountA, 18) : BigInt(0);
  const amountBWei = amountB ? parseUnits(amountB, 18) : BigInt(0);

  const allowanceA = (tokenData?.[0]?.result as bigint) ?? BigInt(0);
  const allowanceB = (tokenData?.[1]?.result as bigint) ?? BigInt(0);
  const balanceA = (tokenData?.[2]?.result as bigint) ?? BigInt(0);
  const balanceB = (tokenData?.[3]?.result as bigint) ?? BigInt(0);

  const needsApprovalA = amountAWei > BigInt(0) && allowanceA < amountAWei;
  const needsApprovalB = amountBWei > BigInt(0) && allowanceB < amountBWei;
  const hasInsufficientBalanceA = amountAWei > balanceA;
  const hasInsufficientBalanceB = amountBWei > balanceB;

  const handleApproveA = () => {
    setLastApprovedToken('A');
    writeContract({
      address: tokenA.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleApproveB = () => {
    setLastApprovedToken('B');
    writeContract({
      address: tokenB.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleAddLiquidity = () => {
    if (!amountA || !amountB || !address) return;
    setLastApprovedToken(null);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

    writeContract({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: 'addLiquidity',
      args: [
        tokenA.address,
        tokenB.address,
        amountAWei,
        amountBWei,
        BigInt(0), // amountAMin
        BigInt(0), // amountBMin
        address,
        deadline,
      ],
    });
  };

  // 判断按钮状态和文字
  const getButtonState = () => {
    if (isPending || isConfirming) {
      return { disabled: true, text: '处理中...', action: () => {} };
    }
    if (!amountA || !amountB) {
      return { disabled: true, text: '请输入数量', action: () => {} };
    }
    // 先检查授权（授权不需要有足够余额）
    if (needsApprovalA) {
      return { disabled: false, text: `授权 ${tokenA.symbol}`, action: handleApproveA, isApproval: true };
    }
    if (needsApprovalB) {
      return { disabled: false, text: `授权 ${tokenB.symbol}`, action: handleApproveB, isApproval: true };
    }
    // 授权完成后再检查余额
    if (hasInsufficientBalanceA) {
      return { disabled: true, text: `${tokenA.symbol} 余额不足`, action: () => {} };
    }
    if (hasInsufficientBalanceB) {
      return { disabled: true, text: `${tokenB.symbol} 余额不足`, action: () => {} };
    }
    return { disabled: false, text: '添加流动性', action: handleAddLiquidity };
  };

  const buttonState = getButtonState();

  return (
    <div className="card">
      <h3>➕ 添加流动性</h3>

      <div className="liquidity-container">
        <div className="input-group">
          <div className="input-label-row">
            <label>Token A</label>
            <span className="balance-hint">
              余额: {parseFloat(formatUnits(balanceA, 18)).toFixed(4)}
              {!needsApprovalA && amountA && <span className="approved-badge">✓ 已授权</span>}
            </span>
          </div>
          <div className="input-row">
            <input
              type="number"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
              className={hasInsufficientBalanceA ? 'input-error' : ''}
            />
            <select
              value={tokenAIndex}
              onChange={(e) => {
                const newIndex = Number(e.target.value);
                if (newIndex === tokenBIndex) {
                  setTokenBIndex(tokenAIndex);
                }
                setTokenAIndex(newIndex);
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

        <div className="plus-sign">+</div>

        <div className="input-group">
          <div className="input-label-row">
            <label>Token B</label>
            <span className="balance-hint">
              余额: {parseFloat(formatUnits(balanceB, 18)).toFixed(4)}
              {!needsApprovalB && amountB && <span className="approved-badge">✓ 已授权</span>}
            </span>
          </div>
          <div className="input-row">
            <input
              type="number"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
              className={hasInsufficientBalanceB ? 'input-error' : ''}
            />
            <select
              value={tokenBIndex}
              onChange={(e) => {
                const newIndex = Number(e.target.value);
                if (newIndex === tokenAIndex) {
                  setTokenAIndex(tokenBIndex);
                }
                setTokenBIndex(newIndex);
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

        {/* 授权状态提示 */}
        {(needsApprovalA || needsApprovalB) && amountA && amountB && (
          <div className="approval-status">
            <div className={`approval-item ${!needsApprovalA ? 'approved' : 'pending'}`}>
              {!needsApprovalA ? '✓' : '○'} {tokenA.symbol}
            </div>
            <div className={`approval-item ${!needsApprovalB ? 'approved' : 'pending'}`}>
              {!needsApprovalB ? '✓' : '○'} {tokenB.symbol}
            </div>
          </div>
        )}

        <button
          onClick={buttonState.action}
          disabled={buttonState.disabled}
          className={`btn ${buttonState.isApproval ? 'btn-secondary' : 'btn-primary'}`}
        >
          {buttonState.text}
        </button>

        {isSuccess && !lastApprovedToken && (
          <div className="success-message">
            ✅ 添加流动性成功!{' '}
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看交易
            </a>
            <button onClick={() => refetchTokenData()} className="btn btn-secondary btn-sm">
              刷新状态
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
