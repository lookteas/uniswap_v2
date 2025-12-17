import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectWallet } from './components/ConnectWallet'
import { TokenBalance } from './components/TokenBalance'
import { MultiHopSwap } from './components/MultiHopSwap'
import { AddLiquidity } from './components/AddLiquidity'
import { RemoveLiquidity } from './components/RemoveLiquidity'
import './App.css'

type Tab = 'swap' | 'add' | 'remove' | 'balance'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('swap')
  const { isConnected } = useAccount()

  return (
    <div className="app">
      <header className="header">
        <h1>🦄 Uniswap V2 DEX</h1>
        <p className="subtitle">Sepolia 测试网</p>
        <ConnectWallet />
      </header>

      <main className="main">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'swap' ? 'active' : ''}`}
            onClick={() => setActiveTab('swap')}
          >
            🔄 Swap
          </button>
          <button
            className={`tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            ➕ 流动性
          </button>
          <button
            className={`tab ${activeTab === 'remove' ? 'active' : ''}`}
            onClick={() => setActiveTab('remove')}
          >
            ➖ 移除
          </button>
          <button
            className={`tab ${activeTab === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            💰 余额
          </button>
        </div>

        {isConnected ? (
          <div className="tab-content">
            {activeTab === 'swap' && <MultiHopSwap />}
            {activeTab === 'add' && <AddLiquidity />}
            {activeTab === 'remove' && <RemoveLiquidity />}
            {activeTab === 'balance' && <TokenBalance />}
          </div>
        ) : (
          <div className="card connect-prompt">
            <p>请先连接钱包以使用 DEX 功能</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          合约地址:{' '}
          <a
            href="https://sepolia.etherscan.io/address/0x3c66Fe68778281be4358F21BfB63aE9cD242aB58"
            target="_blank"
            rel="noopener noreferrer"
          >
            Router
          </a>
          {' | '}
          <a
            href="https://sepolia.etherscan.io/address/0x9A267db279FE7d11138f9293784460Df577c3198"
            target="_blank"
            rel="noopener noreferrer"
          >
            Factory
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
