import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="wallet-info">
        <span className="address">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button onClick={() => disconnect()} className="btn btn-secondary">
          断开连接
        </button>
      </div>
    );
  }

  return (
    <div className="connect-wallet">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="btn btn-primary"
        >
          连接 {connector.name}
        </button>
      ))}
    </div>
  );
}
