import { useState } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, PAIR_ABI, ROUTER_ABI, FACTORY_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';

export function RemoveLiquidity() {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [tokenAIndex, setTokenAIndex] = useState(0);
  const [tokenBIndex, setTokenBIndex] = useState(1);

  const tokenA = TOKENS[tokenAIndex];
  const tokenB = TOKENS[tokenBIndex];

  // 查询交易对地址
  const { data: pairAddressData } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair' as const,
        args: [tokenA?.address, tokenB?.address],
      },
    ],
    query: { enabled: !!tokenA && !!tokenB },
  });

  const pairAddress = pairAddressData?.[0]?.result as `0x${string}` | undefined;
  const hasPair = pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000';

  // 查询 LP 余额和授权额度
  const { data, refetch } = useReadContracts({
    contracts: [
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI,
        functionName: 'allowance',
        args: [address!, CONTRACTS.ROUTER],
      },
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI,
        functionName: 'getReserves',
      },
    ],
    query: { enabled: !!address && !!hasPair },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const lpBalance = (data?.[0]?.result as bigint) ?? BigInt(0);
  const lpAllowance = (data?.[1]?.result as bigint) ?? BigInt(0);
  const rawReserves = data?.[2]?.result as [bigint, bigint, number] | undefined;
  const amountWei = amount ? parseUnits(amount, 18) : BigInt(0);

  // 根据代币地址排序确定正确的储备顺序
  // Uniswap Pair 中 token0 是地址较小的代币
  const isTokenAFirst = tokenA && tokenB && tokenA.address.toLowerCase() < tokenB.address.toLowerCase();
  const reserveA = rawReserves ? (isTokenAFirst ? rawReserves[0] : rawReserves[1]) : undefined;
  const reserveB = rawReserves ? (isTokenAFirst ? rawReserves[1] : rawReserves[0]) : undefined;

  const needsApproval = lpAllowance < amountWei;

  const handleApprove = () => {
    if (!pairAddress) return;
    writeContract({
      address: pairAddress,
      abi: PAIR_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleRemoveLiquidity = () => {
    if (!amount || !address || !tokenA || !tokenB) return;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 minutes

    writeContract({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: 'removeLiquidity',
      args: [
        tokenA.address,
        tokenB.address,
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
        {/* 交易对选择 */}
        <div className="pair-selector">
          <div className="input-group">
            <label>Token A</label>
            <select
              value={tokenAIndex}
              onChange={(e) => {
                const newIndex = Number(e.target.value);
                if (newIndex === tokenBIndex) {
                  setTokenBIndex(tokenAIndex);
                }
                setTokenAIndex(newIndex);
                setAmount('');
              }}
            >
              {TOKENS.map((token, idx) => (
                <option key={token.address} value={idx}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
          <span className="pair-separator">/</span>
          <div className="input-group">
            <label>Token B</label>
            <select
              value={tokenBIndex}
              onChange={(e) => {
                const newIndex = Number(e.target.value);
                if (newIndex === tokenAIndex) {
                  setTokenAIndex(tokenBIndex);
                }
                setTokenBIndex(newIndex);
                setAmount('');
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

        {!hasPair && (
          <div className="no-pair-warning">
            ⚠️ 该交易对不存在
          </div>
        )}

        {hasPair && (
          <>
            <div className="lp-balance">
              <span>LP Token 余额: </span>
              <span className="balance-value">{parseFloat(formatUnits(lpBalance, 18)).toFixed(6)}</span>
              <button onClick={setMaxAmount} className="btn btn-link">
                MAX
              </button>
            </div>

            {reserveA && reserveB && (
              <div className="pool-info">
                <p>池子储备: {parseFloat(formatUnits(reserveA, 18)).toFixed(4)} {tokenA.symbol} / {parseFloat(formatUnits(reserveB, 18)).toFixed(4)} {tokenB.symbol}</p>
              </div>
            )}

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
          </>
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
