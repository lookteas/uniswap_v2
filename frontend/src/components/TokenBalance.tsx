import { useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, PAIR_ABI, FACTORY_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';

// 生成所有可能的交易对组合
function generatePairs() {
  const pairs: { tokenA: typeof TOKENS[0]; tokenB: typeof TOKENS[0] }[] = [];
  for (let i = 0; i < TOKENS.length; i++) {
    for (let j = i + 1; j < TOKENS.length; j++) {
      pairs.push({ tokenA: TOKENS[i], tokenB: TOKENS[j] });
    }
  }
  return pairs;
}

export function TokenBalance() {
  const { address } = useAccount();
  const [activeSection, setActiveSection] = useState<'balance' | 'lp' | 'reserves'>('balance');
  const allPairs = generatePairs();

  // 查询所有代币余额
  const balanceContracts = TOKENS.map(token => ({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf' as const,
    args: [address!],
  }));

  const { data: balances, isLoading: isLoadingBalances, refetch: refetchBalances } = useReadContracts({
    contracts: balanceContracts as any,
    query: { enabled: !!address },
  });

  // 查询所有交易对地址
  const pairAddressContracts = allPairs.map(pair => ({
    address: CONTRACTS.FACTORY,
    abi: FACTORY_ABI,
    functionName: 'getPair' as const,
    args: [pair.tokenA.address, pair.tokenB.address],
  }));

  const { data: pairAddresses } = useReadContracts({
    contracts: pairAddressContracts as any,
    query: { enabled: allPairs.length > 0 },
  });

  // 获取有效的交易对（地址不为零）
  const validPairs = allPairs.map((pair, idx) => {
    const pairAddress = pairAddresses?.[idx]?.result as `0x${string}` | undefined;
    const isValid = pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000';
    return { ...pair, pairAddress, isValid };
  }).filter(p => p.isValid);

  // 查询所有有效交易对的信息
  const pairInfoContracts = validPairs.flatMap(pair => [
    { address: pair.pairAddress!, abi: PAIR_ABI, functionName: 'balanceOf' as const, args: [address!] },
    { address: pair.pairAddress!, abi: PAIR_ABI, functionName: 'getReserves' as const },
    { address: pair.pairAddress!, abi: PAIR_ABI, functionName: 'totalSupply' as const },
  ]);

  const { data: pairInfoData, refetch: refetchPairInfo } = useReadContracts({
    contracts: pairInfoContracts as any,
    query: { enabled: !!address && validPairs.length > 0 },
  });

  // 解析交易对信息
  const pairInfos = validPairs.map((pair, idx) => {
    const baseIdx = idx * 3;
    return {
      ...pair,
      lpBalance: pairInfoData?.[baseIdx]?.result as bigint | undefined,
      reserves: pairInfoData?.[baseIdx + 1]?.result as [bigint, bigint, number] | undefined,
      totalSupply: pairInfoData?.[baseIdx + 2]?.result as bigint | undefined,
    };
  });

  const handleRefresh = () => {
    refetchBalances();
    refetchPairInfo();
  };

  if (!address) {
    return <div className="card">请先连接钱包</div>;
  }

  if (isLoadingBalances) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div className="balance-page">
      {/* 子导航 */}
      <div className="balance-tabs">
        <button
          className={`balance-tab ${activeSection === 'balance' ? 'active' : ''}`}
          onClick={() => setActiveSection('balance')}
        >
          💰 代币余额
        </button>
        <button
          className={`balance-tab ${activeSection === 'lp' ? 'active' : ''}`}
          onClick={() => setActiveSection('lp')}
        >
          🪙 LP 代币
        </button>
        <button
          className={`balance-tab ${activeSection === 'reserves' ? 'active' : ''}`}
          onClick={() => setActiveSection('reserves')}
        >
          📊 池子储备
        </button>
      </div>

      {/* 代币余额 */}
      {activeSection === 'balance' && (
        <div className="card balance-section">
          <div className="section-header">
            <h3>💰 代币余额</h3>
            <span className="item-count">{TOKENS.length} 种代币</span>
          </div>
          <div className="list-header">
            <span className="col-token">代币</span>
            <span className="col-balance">余额</span>
          </div>
          <div className="scrollable-list">
            {TOKENS.map((token, idx) => {
              const balance = balances?.[idx]?.result as bigint | undefined;
              const formattedBalance = balance ? parseFloat(formatUnits(balance, token.decimals)) : 0;
              return (
                <div className="list-row" key={token.address}>
                  <div className="col-token">
                    <span className="token-icon">{token.symbol.charAt(0)}</span>
                    <div className="token-info">
                      <span className="token-symbol">{token.symbol}</span>
                      <span className="token-name-small">{token.name}</span>
                    </div>
                  </div>
                  <div className="col-balance">
                    <span className="balance-value">
                      {formattedBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LP 代币 */}
      {activeSection === 'lp' && (
        <div className="card balance-section">
          <div className="section-header">
            <h3>🪙 LP 代币持仓</h3>
            <span className="item-count">{pairInfos.length} 个池子</span>
          </div>
          {pairInfos.length === 0 ? (
            <div className="empty-state">暂无 LP 代币持仓</div>
          ) : (
            <>
              <div className="list-header">
                <span className="col-pair">交易对</span>
                <span className="col-lp">LP 数量</span>
                <span className="col-share">份额</span>
              </div>
              <div className="scrollable-list">
                {pairInfos.map((pair, idx) => {
                  const lpBalance = pair.lpBalance ? parseFloat(formatUnits(pair.lpBalance, 18)) : 0;
                  const totalSupply = pair.totalSupply ? parseFloat(formatUnits(pair.totalSupply, 18)) : 0;
                  const sharePercent = totalSupply > 0 ? (lpBalance / totalSupply * 100) : 0;
                  return (
                    <div className="list-row" key={idx}>
                      <div className="col-pair">
                        <span className="pair-icons">
                          <span className="token-icon small">{pair.tokenA.symbol.charAt(0)}</span>
                          <span className="token-icon small overlap">{pair.tokenB.symbol.charAt(0)}</span>
                        </span>
                        <span className="pair-name">{pair.tokenA.symbol}/{pair.tokenB.symbol}</span>
                      </div>
                      <div className="col-lp">
                        {lpBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </div>
                      <div className="col-share">
                        {sharePercent.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* 池子储备 */}
      {activeSection === 'reserves' && (
        <div className="card balance-section">
          <div className="section-header">
            <h3>📊 池子储备</h3>
            <span className="item-count">{pairInfos.length} 个池子</span>
          </div>
          {pairInfos.length === 0 ? (
            <div className="empty-state">暂无可用交易对</div>
          ) : (
            <>
              <div className="list-header reserves-header">
                <span className="col-pair">交易对</span>
                <span className="col-reserve">储备 A</span>
                <span className="col-reserve">储备 B</span>
                <span className="col-price">价格</span>
              </div>
              <div className="scrollable-list">
                {pairInfos.map((pair, idx) => {
                  const isTokenAFirst = pair.tokenA.address.toLowerCase() < pair.tokenB.address.toLowerCase();
                  const reserveA = pair.reserves?.[isTokenAFirst ? 0 : 1] ? parseFloat(formatUnits(pair.reserves[isTokenAFirst ? 0 : 1], 18)) : 0;
                  const reserveB = pair.reserves?.[isTokenAFirst ? 1 : 0] ? parseFloat(formatUnits(pair.reserves[isTokenAFirst ? 1 : 0], 18)) : 0;
                  const price = reserveA > 0 ? reserveB / reserveA : 0;
                  return (
                    <div className="list-row reserves-row" key={idx}>
                      <div className="col-pair">
                        <span className="pair-icons">
                          <span className="token-icon small">{pair.tokenA.symbol.charAt(0)}</span>
                          <span className="token-icon small overlap">{pair.tokenB.symbol.charAt(0)}</span>
                        </span>
                        <span className="pair-name">{pair.tokenA.symbol}/{pair.tokenB.symbol}</span>
                      </div>
                      <div className="col-reserve">
                        <span className="reserve-amount">{reserveA.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        <span className="reserve-symbol">{pair.tokenA.symbol}</span>
                      </div>
                      <div className="col-reserve">
                        <span className="reserve-amount">{reserveB.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        <span className="reserve-symbol">{pair.tokenB.symbol}</span>
                      </div>
                      <div className="col-price">
                        {price.toFixed(4)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={handleRefresh} className="btn btn-secondary refresh-btn">
        🔄 刷新数据
      </button>
    </div>
  );
}
