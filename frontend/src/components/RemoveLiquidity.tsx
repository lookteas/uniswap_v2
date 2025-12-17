import { useState } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, PAIR_ABI, ROUTER_ABI } from '../config/contracts';

export function RemoveLiquidity() {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');

  // 查询 LP 余额和授权额度
  const { data, refetch } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.PAIR,
        abi: PAIR_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: CONTRACTS.PAIR,
        abi: PAIR_ABI,
        functionName: 'allowance',
        args: [address!, CONTRACTS.ROUTER],
      },
    ],
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const lpBalance = (data?.[0]?.result as bigint) ?? BigInt(0);
  const lpAllowance = (data?.[1]?.result as bigint) ?? BigInt(0);
  const amountWei = amount ? parseUnits(amount, 18) : BigInt(0);

  const needsApproval = lpAllowance < amountWei;

  const handleApprove = () => {
    writeContract({
      address: CONTRACTS.PAIR,
      abi: PAIR_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleRemoveLiquidity = () => {
    if (!amount || !address) return;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

    writeContract({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: 'removeLiquidity',
      args: [
        CONTRACTS.TOKEN_A,
        CONTRACTS.TOKEN_B,
        amountWei,
        BigInt(0), // amountAMin
        BigInt(0), // amountBMin
        address,
        deadline,
      ],
    });
  };

  const setMaxAmount = () => {
    if (lpBalance > BigInt(0)) {
      setAmount(formatUnits(lpBalance, 18));
    }
  };

  return (
    <div className="card">
      <h3>➖ 移除流动性</h3>

      <div className="liquidity-container">
        <div className="lp-balance">
          <span>LP Token 余额: </span>
          <span className="balance-value">{formatUnits(lpBalance, 18)}</span>
          <button onClick={setMaxAmount} className="btn btn-link">
            MAX
          </button>
        </div>

        <div className="input-group">
          <label>移除数量 (LP Token)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            min="0"
            step="0.1"
          />
        </div>

        {needsApproval && amount ? (
          <button
            onClick={handleApprove}
            disabled={isPending || isConfirming}
            className="btn btn-primary"
          >
            {isPending || isConfirming ? '处理中...' : '授权 LP Token'}
          </button>
        ) : (
          <button
            onClick={handleRemoveLiquidity}
            disabled={!amount || amountWei > lpBalance || isPending || isConfirming}
            className="btn btn-danger"
          >
            {isPending || isConfirming ? '处理中...' : '移除流动性'}
          </button>
        )}

        {isSuccess && (
          <div className="success-message">
            ✅ 移除流动性成功!{' '}
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看交易
            </a>
            <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
              刷新状态
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
