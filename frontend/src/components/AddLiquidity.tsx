import { useState } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, ROUTER_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';

export function AddLiquidity() {
  const { address } = useAccount();
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [tokenAIndex, setTokenAIndex] = useState(0);
  const [tokenBIndex, setTokenBIndex] = useState(1);

  const tokenA = TOKENS[tokenAIndex];
  const tokenB = TOKENS[tokenBIndex];

  // 查询两个代币的授权额度
  const { data: allowances, refetch: refetchAllowances } = useReadContracts({
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
    ],
    query: { enabled: !!address && !!tokenA && !!tokenB },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const amountAWei = amountA ? parseUnits(amountA, 18) : BigInt(0);
  const amountBWei = amountB ? parseUnits(amountB, 18) : BigInt(0);

  const allowanceA = (allowances?.[0]?.result as bigint) ?? BigInt(0);
  const allowanceB = (allowances?.[1]?.result as bigint) ?? BigInt(0);

  const needsApprovalA = allowanceA < amountAWei;
  const needsApprovalB = allowanceB < amountBWei;

  const handleApproveA = () => {
    writeContract({
      address: tokenA.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleApproveB = () => {
    writeContract({
      address: tokenB.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleAddLiquidity = () => {
    if (!amountA || !amountB || !address) return;

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

  return (
    <div className="card">
      <h3>➕ 添加流动性</h3>

      <div className="liquidity-container">
        <div className="input-group">
          <label>Token A</label>
          <div className="input-row">
            <input
              type="number"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
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
          {needsApprovalA && amountA && (
            <button
              onClick={handleApproveA}
              disabled={isPending || isConfirming}
              className="btn btn-secondary btn-sm"
            >
              授权 {tokenA.symbol}
            </button>
          )}
        </div>

        <div className="plus-sign">+</div>

        <div className="input-group">
          <label>Token B</label>
          <div className="input-row">
            <input
              type="number"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
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
          {needsApprovalB && amountB && (
            <button
              onClick={handleApproveB}
              disabled={isPending || isConfirming}
              className="btn btn-secondary btn-sm"
            >
              授权 {tokenB.symbol}
            </button>
          )}
        </div>

        <button
          onClick={handleAddLiquidity}
          disabled={!amountA || !amountB || needsApprovalA || needsApprovalB || isPending || isConfirming}
          className="btn btn-primary"
        >
          {isPending || isConfirming ? '处理中...' : '添加流动性'}
        </button>

        {isSuccess && (
          <div className="success-message">
            ✅ 添加流动性成功!{' '}
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看交易
            </a>
            <button onClick={() => refetchAllowances()} className="btn btn-secondary btn-sm">
              刷新状态
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
