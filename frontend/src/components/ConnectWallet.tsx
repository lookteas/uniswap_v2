import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, formatEther, parseEther } from 'viem';
import { CONTRACTS, FAUCET_ABI, WETH_ABI } from '../config/contracts';
import { WETH_ADDRESS } from '../config/tokens';

interface ConnectWalletProps {
  usePermit2?: boolean;
  setUsePermit2?: (value: boolean) => void;
  showSettings?: boolean;
  setShowSettings?: (value: boolean) => void;
}

type PopupType = 'none' | 'faucet' | 'settings' | 'weth';

export function ConnectWallet({ usePermit2, setUsePermit2, showSettings, setShowSettings }: ConnectWalletProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  // 统一管理弹窗状态（互斥）
  const [activePopup, setActivePopup] = useState<PopupType>('none');
  const [wethAmount, setWethAmount] = useState('');
  const [wethMode, setWethMode] = useState<'wrap' | 'unwrap'>('wrap');
  const popupRef = useRef<HTMLDivElement>(null);

  // ETH 余额
  const { data: ethBalance } = useBalance({ address });

  // WETH 余额
  const { data: wethBalance, refetch: refetchWeth } = useReadContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address },
  });

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setActivePopup('none');
        setShowSettings?.(false);
      }
    };

    if (activePopup !== 'none') {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activePopup, setShowSettings]);

  // 同步外部 showSettings 状态
  useEffect(() => {
    if (showSettings && activePopup !== 'settings') {
      setActivePopup('settings');
    } else if (!showSettings && activePopup === 'settings') {
      setActivePopup('none');
    }
  }, [showSettings, activePopup]);

  // Faucet 状态查询
  const { data: faucetStatus, refetch: refetchFaucet } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.FAUCET,
        abi: FAUCET_ABI,
        functionName: 'canClaim',
        args: [address!],
      },
      {
        address: CONTRACTS.FAUCET,
        abi: FAUCET_ABI,
        functionName: 'claimAmount',
      },
    ],
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const canClaim = faucetStatus?.[0]?.result === true;
  const claimAmount = (faucetStatus?.[1]?.result as bigint) ?? BigInt(0);
  const claimAmountFormatted = parseFloat(formatUnits(claimAmount, 18)).toFixed(0);

  const handleClaim = () => {
    writeContract({
      address: CONTRACTS.FAUCET,
      abi: FAUCET_ABI,
      functionName: 'claim',
    });
  };

  // 成功后刷新
  useEffect(() => {
    if (isSuccess) {
      refetchFaucet();
      refetchWeth();
      setWethAmount('');
    }
  }, [isSuccess, refetchFaucet, refetchWeth]);

  // 切换弹窗（互斥逻辑）
  const togglePopup = (popup: PopupType) => {
    if (activePopup === popup) {
      setActivePopup('none');
      if (popup === 'settings') setShowSettings?.(false);
    } else {
      setActivePopup(popup);
      if (popup === 'settings') setShowSettings?.(true);
      else setShowSettings?.(false);
    }
  };

  // 关闭弹窗
  const closePopup = () => {
    setActivePopup('none');
    setShowSettings?.(false);
  };

  if (isConnected) {
    return (
      <div className="wallet-info" ref={popupRef}>
        <span className="address">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <div className="wallet-actions">
          <button onClick={() => disconnect()} className="btn btn-secondary">
            断开连接
          </button>
          <button 
            className={`icon-btn ${activePopup === 'faucet' ? 'active' : ''}`}
            onClick={() => togglePopup('faucet')}
            title="领取测试币"
          >
            💧
          </button>
          <button 
            className={`icon-btn ${activePopup === 'weth' ? 'active' : ''}`}
            onClick={() => togglePopup('weth')}
            title="ETH ↔ WETH"
          >
            🏦
          </button>
          {setShowSettings && (
            <button 
              className={`icon-btn ${activePopup === 'settings' ? 'active' : ''}`}
              onClick={() => togglePopup('settings')}
              title="设置"
            >
              ⚙️
            </button>
          )}
        </div>

        {/* 居中模态框 */}
        {activePopup !== 'none' && (
          <div className="modal-overlay" onClick={closePopup}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={closePopup}>✕</button>
              
              {/* Faucet 弹窗内容 */}
              {activePopup === 'faucet' && (
                <>
                  <h3>🚰 测试币水龙头</h3>
                  <p className="modal-desc">一键领取 5 种测试代币，每种 {claimAmountFormatted} 个</p>
                  <div className="modal-tokens">
                    <span className="token-badge">TKA</span>
                    <span className="token-badge">TKB</span>
                    <span className="token-badge">TKC</span>
                    <span className="token-badge">TKD</span>
                    <span className="token-badge">TKE</span>
                  </div>
                  {canClaim ? (
                    <button 
                      onClick={handleClaim} 
                      disabled={isPending || isConfirming}
                      className="btn btn-primary modal-btn"
                    >
                      {isPending || isConfirming ? '处理中...' : '🚰 领取测试币'}
                    </button>
                  ) : (
                    <button disabled className="btn btn-secondary modal-btn">
                      ✅ 已领取过
                    </button>
                  )}
                  {isSuccess && (
                    <p className="success-text">
                      ✅ 领取成功！
                      <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">
                        查看交易
                      </a>
                    </p>
                  )}
                </>
              )}

              {/* 设置弹窗内容 */}
              {activePopup === 'settings' && setUsePermit2 && (
                <>
                  <h3>⚙️ 设置</h3>
                  <div className="settings-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={!usePermit2}
                        onChange={(e) => setUsePermit2(!e.target.checked)}
                      />
                      使用传统授权模式
                    </label>
                    <small>默认使用 Permit2（推荐）</small>
                  </div>
                </>
              )}

              {/* WETH 弹窗内容 */}
              {activePopup === 'weth' && (
                <>
                  <h3>Ξ ETH ↔ WETH</h3>
                  <div className="balance-row">
                    <span>ETH: {parseFloat(formatEther(ethBalance?.value ?? BigInt(0))).toFixed(4)}</span>
                    <span>WETH: {parseFloat(formatEther((wethBalance as bigint) ?? BigInt(0))).toFixed(4)}</span>
                  </div>
                  <div className="wrap-tabs">
                    <button 
                      className={`wrap-tab ${wethMode === 'wrap' ? 'active' : ''}`}
                      onClick={() => { setWethMode('wrap'); setWethAmount(''); }}
                    >
                      包装 (Wrap)
                    </button>
                    <button 
                      className={`wrap-tab ${wethMode === 'unwrap' ? 'active' : ''}`}
                      onClick={() => { setWethMode('unwrap'); setWethAmount(''); }}
                    >
                      解包 (Unwrap)
                    </button>
                  </div>
                  <div className="input-group">
                    <label>{wethMode === 'wrap' ? 'ETH 数量' : 'WETH 数量'}</label>
                    <div className="input-with-max">
                      <input
                        type="number"
                        value={wethAmount}
                        onChange={(e) => setWethAmount(e.target.value)}
                        placeholder="0.0"
                        step="0.01"
                      />
                      <button 
                        className="max-btn"
                        onClick={() => {
                          const maxAmount = wethMode === 'wrap' 
                            ? (ethBalance?.value ?? BigInt(0)) > parseEther('0.01') 
                              ? (ethBalance?.value ?? BigInt(0)) - parseEther('0.01') 
                              : BigInt(0)
                            : (wethBalance as bigint) ?? BigInt(0);
                          setWethAmount(formatEther(maxAmount));
                        }}
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!wethAmount) return;
                      const amountWei = parseEther(wethAmount);
                      if (wethMode === 'wrap') {
                        writeContract({
                          address: WETH_ADDRESS,
                          abi: WETH_ABI,
                          functionName: 'deposit',
                          value: amountWei,
                        });
                      } else {
                        writeContract({
                          address: WETH_ADDRESS,
                          abi: WETH_ABI,
                          functionName: 'withdraw',
                          args: [amountWei],
                        });
                      }
                    }}
                    disabled={!wethAmount || parseFloat(wethAmount) <= 0 || isPending || isConfirming}
                    className="btn btn-primary modal-btn"
                  >
                    {isPending || isConfirming ? '处理中...' : wethMode === 'wrap' ? '包装 ETH → WETH' : '解包 WETH → ETH'}
                  </button>
                  {isSuccess && activePopup === 'weth' && (
                    <p className="success-text">
                      ✅ {wethMode === 'wrap' ? '包装' : '解包'}成功！
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 只使用第一个连接器（避免显示重复选项）
  const connector = connectors[0];
  
  return (
    <div className="connect-wallet">
      <button
        onClick={() => connect({ connector })}
        className="btn btn-primary"
      >
        连接钱包
      </button>
    </div>
  );
}
