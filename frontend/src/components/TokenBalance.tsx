import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, PAIR_ABI } from '../config/contracts';

export function TokenBalance() {
  const { address } = useAccount();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.TOKEN_A,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: CONTRACTS.TOKEN_B,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: CONTRACTS.PAIR,
        abi: PAIR_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: CONTRACTS.PAIR,
        abi: PAIR_ABI,
        functionName: 'getReserves',
      },
      {
        address: CONTRACTS.PAIR,
        abi: PAIR_ABI,
        functionName: 'totalSupply',
      },
    ],
    query: {
      enabled: !!address,
    },
  });

  if (!address) {
    return <div className="card">请先连接钱包</div>;
  }

  if (isLoading) {
    return <div className="card">加载中...</div>;
  }

  const tokenABalance = data?.[0]?.result as bigint | undefined;
  const tokenBBalance = data?.[1]?.result as bigint | undefined;
  const lpBalance = data?.[2]?.result as bigint | undefined;
  const reserves = data?.[3]?.result as [bigint, bigint, number] | undefined;
  const totalSupply = data?.[4]?.result as bigint | undefined;

  return (
    <div className="card">
      <h3>💰 代币余额</h3>
      <div className="balance-grid">
        <div className="balance-item">
          <span className="token-name">TKA</span>
          <span className="token-balance">
            {tokenABalance ? formatUnits(tokenABalance, 18) : '0'}
          </span>
        </div>
        <div className="balance-item">
          <span className="token-name">TKB</span>
          <span className="token-balance">
            {tokenBBalance ? formatUnits(tokenBBalance, 18) : '0'}
          </span>
        </div>
        <div className="balance-item">
          <span className="token-name">LP Token</span>
          <span className="token-balance">
            {lpBalance ? formatUnits(lpBalance, 18) : '0'}
          </span>
        </div>
      </div>

      <h4>📊 池子储备</h4>
      <div className="reserves-info">
        <p>Reserve TKA: {reserves?.[0] ? formatUnits(reserves[0], 18) : '0'}</p>
        <p>Reserve TKB: {reserves?.[1] ? formatUnits(reserves[1], 18) : '0'}</p>
        <p>Total LP Supply: {totalSupply ? formatUnits(totalSupply, 18) : '0'}</p>
      </div>

      <button onClick={() => refetch()} className="btn btn-secondary">
        刷新余额
      </button>
    </div>
  );
}
