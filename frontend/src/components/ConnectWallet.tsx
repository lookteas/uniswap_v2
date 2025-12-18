import { useAccount, useConnect, useDisconnect } from 'wagmi';

interface ConnectWalletProps {
  usePermit2?: boolean;
  setUsePermit2?: (value: boolean) => void;
  showSettings?: boolean;
  setShowSettings?: (value: boolean) => void;
}

export function ConnectWallet({ usePermit2, setUsePermit2, showSettings, setShowSettings }: ConnectWalletProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="wallet-info">
        <span className="address">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <div className="wallet-actions">
          <button onClick={() => disconnect()} className="btn btn-secondary">
            断开连接
          </button>
          {setShowSettings && (
            <button 
              className="settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="设置"
            >
              ⚙️
            </button>
          )}
        </div>
        {showSettings && setUsePermit2 && (
          <div className="header-settings-panel">
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
