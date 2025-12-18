import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSignTypedData } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, PERMIT2_ROUTER_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';
import { usePathFinder, formatPath } from '../hooks/usePathFinder';

const PERMIT2_TRANSFER_TYPES = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
};

export function SwapPermit2() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [amountIn, setAmountIn] = useState('');
  const [tokenInIndex, setTokenInIndex] = useState(0);
  const [tokenOutIndex, setTokenOutIndex] = useState(1);
  const [slippage, setSlippage] = useState(0.5);
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);
  const [showSwapSettings, setShowSwapSettings] = useState(false);
  const [permit2Nonce, setPermit2Nonce] = useState(BigInt(Date.now()));
  const [isSigning, setIsSigning] = useState(false);

  const [selectedPathIndex, setSelectedPathIndex] = useState(0);

  const tokenIn = TOKENS[tokenInIndex];
  const tokenOut = TOKENS[tokenOutIndex];

  const { signTypedDataAsync } = useSignTypedData();

  // 使用路径查找 Hook
  const { paths, bestPath, isLoading: isLoadingPaths } = usePathFinder(
    tokenIn,
    tokenOut,
    amountIn
  );

  // 当前选择的路径
  const selectedPath = paths[selectedPathIndex] || bestPath;

  // 查询余额和 Permit2 授权
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!tokenIn },
  });

  const { data: permit2Allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn?.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, CONTRACTS.PERMIT2],
    query: { enabled: !!address && !!tokenIn },
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      refetchBalance();
      refetchAllowance();
      setPermit2Nonce(prev => prev + BigInt(1));
      setTimeout(() => reset(), 3000);
    }
  }, [isSuccess, refetchBalance, refetchAllowance, reset]);

  // 只在切换输入代币时清空数量，切换输出代币时保留输入数量
  useEffect(() => {
    reset();
    setAmountIn('');
    setSelectedPathIndex(0);
  }, [tokenInIndex, reset]);

  // 切换输出代币时只重置路径选择
  useEffect(() => {
    setSelectedPathIndex(0);
  }, [tokenOutIndex]);

  // 切换代币
  const handleSwapTokens = () => {
    setTokenInIndex(tokenOutIndex);
    setTokenOutIndex(tokenInIndex);
    setSelectedPathIndex(0);
  };

  const amountInWei = amountIn ? parseUnits(amountIn, 18) : BigInt(0);
  const balanceValue = (balance as bigint) ?? BigInt(0);
  const permit2AllowanceValue = (permit2Allowance as bigint) ?? BigInt(0);

  const hasInsufficientBalance = amountInWei > balanceValue;
  const needsPermit2Approval = permit2AllowanceValue < amountInWei;

  const estimatedOutput = selectedPath?.amountOut 
    ? formatUnits(selectedPath.amountOut, 18) 
    : '0';
  const minOut = selectedPath?.amountOut 
    ? (selectedPath.amountOut * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000)
    : BigInt(0);

  const handleApproveToPermit2 = () => {
    writeContract({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.PERMIT2, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
  };

  const handleSignAndSwap = async () => {
    if (!address || !amountIn) return;

    setIsSigning(true);

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

      const permit2Domain = {
        name: 'Permit2',
        chainId: chainId,
        verifyingContract: CONTRACTS.PERMIT2,
      };

      const signature = await signTypedDataAsync({
        domain: permit2Domain,
        types: PERMIT2_TRANSFER_TYPES,
        primaryType: 'PermitTransferFrom',
        message: {
          permitted: {
            token: tokenIn.address,
            amount: amountInWei,
          },
          spender: CONTRACTS.PERMIT2_ROUTER,
          nonce: permit2Nonce,
          deadline: deadline,
        },
      });

      setIsSigning(false);

      writeContract({
        address: CONTRACTS.PERMIT2_ROUTER,
        abi: PERMIT2_ROUTER_ABI,
        functionName: 'swapWithPermit2',
        args: [
          {
            amountIn: amountInWei,
            amountOutMin: minOut,
            path: selectedPath?.addresses || [tokenIn.address, tokenOut.address],
            to: address,
            deadline: deadline,
          },
          {
            nonce: permit2Nonce,
            signature: signature,
          },
        ],
        gas: BigInt(500000),
      });
    } catch (error) {
      console.error('签名失败:', error);
      setIsSigning(false);
    }
  };

  const getButtonState = () => {
    if (!address) return { disabled: true, text: '请先连接钱包' };
    if (!amountIn || parseFloat(amountIn) <= 0) return { disabled: true, text: '请输入数量' };
    if (!selectedPath && !isLoadingPaths && amountIn) return { disabled: true, text: '没有可用路径' };
    if (hasInsufficientBalance) return { disabled: true, text: `${tokenIn.symbol} 余额不足` };
    if (needsPermit2Approval) return { disabled: false, text: `授权 ${tokenIn.symbol} 给 Permit2`, action: 'approve' };
    if (isSigning) return { disabled: true, text: '✍️ 请在钱包中签名...' };
    if (isPending || isConfirming) return { disabled: true, text: '⏳ 交易处理中...' };
    return { disabled: false, text: '✍️ 签名并 Swap', action: 'swap' };
  };

  const buttonState = getButtonState();

  return (
    <div className="card">
      <div className="card-header">
        <h3>🔄 Swap <span className="permit2-badge">Permit2</span></h3>
        <button 
          className="settings-btn" 
          onClick={() => setShowSwapSettings(!showSwapSettings)}
          title="设置"
        >
          ⚙️
        </button>
      </div>

      {showSwapSettings && (
        <div className="swap-settings-panel">
          <div className="settings-item">
            <label>滑点容忍度</label>
            <div className="slippage-options">
              {[0.1, 0.5, 1.0].map((val) => (
                <button
                  key={val}
                  className={`slippage-btn ${slippage === val ? 'active' : ''}`}
                  onClick={() => setSlippage(val)}
                >
                  {val}%
                </button>
              ))}
              <div className="slippage-custom">
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                  min="0.1"
                  max="50"
                  step="0.1"
                />
                <span>%</span>
              </div>
            </div>
          </div>
          <div className="settings-item">
            <label>交易截止时间</label>
            <div className="deadline-input">
              <input
                type="number"
                value={deadlineMinutes}
                onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                min="1"
                max="180"
              />
              <span>分钟</span>
            </div>
          </div>
        </div>
      )}

      <div className="swap-container">
        <div className="input-group">
          <label>输入数量</label>
          <div className="input-row">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
            />
            <select value={tokenInIndex} onChange={(e) => {
              const newIndex = Number(e.target.value);
              setTokenInIndex(newIndex);
              if (newIndex === tokenOutIndex) {
                setTokenOutIndex(tokenInIndex);
              }
            }}>
              {TOKENS.map((token, index) => (
                <option key={token.address} value={index}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
          <small className="balance-hint">
            余额: {parseFloat(formatUnits(balanceValue, 18)).toFixed(4)} {tokenIn.symbol}
          </small>
        </div>

        <div className="swap-arrow" onClick={handleSwapTokens} style={{ cursor: 'pointer' }}>
          ⇅
        </div>

        <div className="input-group">
          <label>输出代币</label>
          <div className="input-row">
            <div className="output-display" style={{ flex: 1 }}>
              <span className="output-value">
                {isLoadingPaths ? '计算中...' : (parseFloat(estimatedOutput) > 0 ? parseFloat(estimatedOutput).toFixed(6) : '0.0')}
              </span>
            </div>
            <select value={tokenOutIndex} onChange={(e) => {
              const newIndex = Number(e.target.value);
              if (newIndex === tokenInIndex) {
                setTokenInIndex(tokenOutIndex);
              }
              setTokenOutIndex(newIndex);
              setSelectedPathIndex(0);
            }}>
              {TOKENS.map((token, index) => (
                <option key={token.address} value={index}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 路径选择 */}
        {paths.length > 0 && (
          <div className="path-selector">
            <label>选择路径 ({paths.length} 条可用)</label>
            <div className="path-list">
              {paths.map((p, idx) => (
                <div
                  key={idx}
                  className={`path-item ${selectedPathIndex === idx ? 'selected' : ''}`}
                  onClick={() => setSelectedPathIndex(idx)}
                >
                  <span className="path-route">{formatPath(p.path)}</span>
                  <span className="path-output">
                    {parseFloat(formatUnits(p.amountOut, 18)).toFixed(6)} {tokenOut.symbol}
                  </span>
                  {idx === 0 && <span className="best-tag">最优</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {paths.length === 0 && amountIn && parseFloat(amountIn) > 0 && !isLoadingPaths && (
          <div className="no-path-warning">
            ⚠️ 没有找到可用的交易路径，请检查交易对是否存在流动性
          </div>
        )}

        <div className="swap-info">
          <p>滑点: {slippage}% | 截止: {deadlineMinutes}分钟</p>
          {selectedPath && (
            <p>路径: {formatPath(selectedPath.path)} ({selectedPath.path.length - 1} 跳)</p>
          )}
        </div>

        <button
          onClick={buttonState.action === 'approve' ? handleApproveToPermit2 : handleSignAndSwap}
          disabled={buttonState.disabled}
          className="btn btn-action"
        >
          {buttonState.text}
        </button>

        {isSuccess && (
          <div className="success-message">
            ✅ 交易成功!{' '}
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看交易
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
