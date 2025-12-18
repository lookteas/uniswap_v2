import { useState, useEffect } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSignTypedData, useChainId } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, ROUTER_ABI, PERMIT_ABI, FACTORY_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';

// EIP-712 Permit 类型定义
const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function AddLiquidity() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [tokenAIndex, setTokenAIndex] = useState(0);
  const [tokenBIndex, setTokenBIndex] = useState(1);
  const [lastApprovedToken, setLastApprovedToken] = useState<'A' | 'B' | null>(null);
  const [isSigningA, setIsSigningA] = useState(false);
  const [isSigningB, setIsSigningB] = useState(false);
  const [permitSignatureA, setPermitSignatureA] = useState<{ v: number; r: `0x${string}`; s: `0x${string}`; deadline: bigint } | null>(null);
  const [permitSignatureB, setPermitSignatureB] = useState<{ v: number; r: `0x${string}`; s: `0x${string}`; deadline: bigint } | null>(null);
  const [usePermit] = useState(true); // 默认使用 Permit 签名授权

  const tokenA = TOKENS[tokenAIndex];
  const tokenB = TOKENS[tokenBIndex];

  // 查询两个代币的授权额度、余额、nonces 和交易对是否存在
  const { data: tokenData, refetch: refetchTokenData } = useReadContracts({
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
      {
        address: tokenA?.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: tokenB?.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      // Permit nonces
      {
        address: tokenA?.address,
        abi: PERMIT_ABI,
        functionName: 'nonces',
        args: [address!],
      },
      {
        address: tokenB?.address,
        abi: PERMIT_ABI,
        functionName: 'nonces',
        args: [address!],
      },
      // 查询交易对是否存在
      {
        address: CONTRACTS.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenA?.address, tokenB?.address],
      },
    ],
    query: { enabled: !!address && !!tokenA && !!tokenB },
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // 授权成功后自动刷新
  useEffect(() => {
    if (isSuccess && lastApprovedToken) {
      refetchTokenData();
      setLastApprovedToken(null);
      // 延迟重置，让用户看到成功提示
      setTimeout(() => reset(), 3000);
    }
  }, [isSuccess, lastApprovedToken, refetchTokenData, reset]);

  // 切换代币时重置状态
  useEffect(() => {
    reset();
    setAmountA('');
    setAmountB('');
    setPermitSignatureA(null);
    setPermitSignatureB(null);
  }, [tokenAIndex, tokenBIndex, reset]);

  const amountAWei = amountA ? parseUnits(amountA, 18) : BigInt(0);
  const amountBWei = amountB ? parseUnits(amountB, 18) : BigInt(0);

  const allowanceA = (tokenData?.[0]?.result as bigint) ?? BigInt(0);
  const allowanceB = (tokenData?.[1]?.result as bigint) ?? BigInt(0);
  const balanceA = (tokenData?.[2]?.result as bigint) ?? BigInt(0);
  const balanceB = (tokenData?.[3]?.result as bigint) ?? BigInt(0);
  const nonceA = (tokenData?.[4]?.result as bigint) ?? BigInt(0);
  const nonceB = (tokenData?.[5]?.result as bigint) ?? BigInt(0);
  const pairAddress = (tokenData?.[6]?.result as `0x${string}`) ?? '0x0000000000000000000000000000000000000000';
  
  // 交易对是否存在（非零地址表示存在）
  const pairExists = pairAddress !== '0x0000000000000000000000000000000000000000';
  // 动态 gas limit：存在交易对用 300k，不存在用 3M（需要创建 Pair 合约）
  const gasLimit = pairExists ? BigInt(300000) : BigInt(3000000);

  // 检查是否有有效的 Permit 签名
  const hasValidPermitA = permitSignatureA && permitSignatureA.deadline > BigInt(Math.floor(Date.now() / 1000));
  const hasValidPermitB = permitSignatureB && permitSignatureB.deadline > BigInt(Math.floor(Date.now() / 1000));

  const needsApprovalA = amountAWei > BigInt(0) && allowanceA < amountAWei && !hasValidPermitA;
  const needsApprovalB = amountBWei > BigInt(0) && allowanceB < amountBWei && !hasValidPermitB;
  const hasInsufficientBalanceA = amountAWei > balanceA;
  const hasInsufficientBalanceB = amountBWei > balanceB;

  // 一次性签名两个代币的 Permit 并自动执行后续流程
  const handleSignAndExecute = async () => {
    if (!address) return;
    
    const needSignA = tokenA.supportsPermit && allowanceA < amountAWei;
    const needSignB = tokenB.supportsPermit && allowanceB < amountBWei;
    
    if (!needSignA && !needSignB) {
      // 不需要签名，直接添加流动性
      handleAddLiquidity();
      return;
    }
    
    setIsSigningA(needSignA);
    setIsSigningB(needSignB);
    
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 分钟
      let sigA: { v: number; r: `0x${string}`; s: `0x${string}`; deadline: bigint } | null = null;
      let sigB: { v: number; r: `0x${string}`; s: `0x${string}`; deadline: bigint } | null = null;
      
      // 签名 Token A
      if (needSignA) {
        const domainA = {
          name: tokenA.name,
          version: '1',
          chainId: chainId,
          verifyingContract: tokenA.address,
        };
        const messageA = {
          owner: address,
          spender: CONTRACTS.ROUTER,
          value: amountAWei,
          nonce: nonceA,
          deadline: deadline,
        };
        const signatureA = await signTypedDataAsync({
          domain: domainA,
          types: PERMIT_TYPES,
          primaryType: 'Permit',
          message: messageA,
        });
        const rA = `0x${signatureA.slice(2, 66)}` as `0x${string}`;
        const sA = `0x${signatureA.slice(66, 130)}` as `0x${string}`;
        const vA = parseInt(signatureA.slice(130, 132), 16);
        sigA = { v: vA, r: rA, s: sA, deadline };
        setPermitSignatureA(sigA);
      }
      setIsSigningA(false);
      
      // 签名 Token B
      if (needSignB) {
        const domainB = {
          name: tokenB.name,
          version: '1',
          chainId: chainId,
          verifyingContract: tokenB.address,
        };
        const messageB = {
          owner: address,
          spender: CONTRACTS.ROUTER,
          value: amountBWei,
          nonce: nonceB,
          deadline: deadline,
        };
        const signatureB = await signTypedDataAsync({
          domain: domainB,
          types: PERMIT_TYPES,
          primaryType: 'Permit',
          message: messageB,
        });
        const rB = `0x${signatureB.slice(2, 66)}` as `0x${string}`;
        const sB = `0x${signatureB.slice(66, 130)}` as `0x${string}`;
        const vB = parseInt(signatureB.slice(130, 132), 16);
        sigB = { v: vB, r: rB, s: sB, deadline };
        setPermitSignatureB(sigB);
      }
      setIsSigningB(false);
      
      // 签名完成后，自动执行 permit 交易
      if (sigA) {
        setPermitStep('permitA');
        writeContract({
          address: tokenA.address,
          abi: PERMIT_ABI,
          functionName: 'permit',
          args: [address, CONTRACTS.ROUTER, amountAWei, sigA.deadline, sigA.v, sigA.r, sigA.s],
        });
      } else if (sigB) {
        setPermitStep('permitB');
        writeContract({
          address: tokenB.address,
          abi: PERMIT_ABI,
          functionName: 'permit',
          args: [address, CONTRACTS.ROUTER, amountBWei, sigB.deadline, sigB.v, sigB.r, sigB.s],
        });
      }
    } catch (error) {
      console.error('Permit signing failed:', error);
      setIsSigningA(false);
      setIsSigningB(false);
    }
  };

  // 传统 approve 函数（作为备选）
  const handleApproveA = () => {
    setLastApprovedToken('A');
    writeContract({
      address: tokenA.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  const handleApproveB = () => {
    setLastApprovedToken('B');
    writeContract({
      address: tokenB.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('1000000', 18)],
    });
  };

  
  const handleAddLiquidity = async () => {
    if (!amountA || !amountB || !address) return;
    setLastApprovedToken(null);

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
      gas: gasLimit,
    });
  };

  // 处理 Permit 签名后的流程：先执行 permit 交易，再添加流动性
  const [permitStep, setPermitStep] = useState<'idle' | 'permitA' | 'permitB' | 'addLiquidity'>('idle');
  
  // 监听交易成功，自动进入下一步
  useEffect(() => {
    if (isSuccess && address) {
      if (permitStep === 'permitA') {
        // Token A permit 完成
        setPermitSignatureA(null); // 清除已使用的签名
        reset();
        if (permitSignatureB) {
          // 继续 Token B permit
          setPermitStep('permitB');
          setTimeout(() => {
            writeContract({
              address: tokenB.address,
              abi: PERMIT_ABI,
              functionName: 'permit',
              args: [
                address,
                CONTRACTS.ROUTER,
                amountBWei,
                permitSignatureB.deadline,
                permitSignatureB.v,
                permitSignatureB.r,
                permitSignatureB.s,
              ],
            });
          }, 100);
        } else {
          // 没有 Token B 签名，直接添加流动性
          setPermitStep('addLiquidity');
          refetchTokenData();
          setTimeout(() => {
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
            writeContract({
              address: CONTRACTS.ROUTER,
              abi: ROUTER_ABI,
              functionName: 'addLiquidity',
              args: [tokenA.address, tokenB.address, amountAWei, amountBWei, BigInt(0), BigInt(0), address, deadline],
              gas: gasLimit,
            });
          }, 100);
        }
      } else if (permitStep === 'permitB') {
        // Token B permit 完成，添加流动性
        setPermitSignatureB(null);
        setPermitStep('addLiquidity');
        reset();
        refetchTokenData();
        setTimeout(() => {
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
          writeContract({
            address: CONTRACTS.ROUTER,
            abi: ROUTER_ABI,
            functionName: 'addLiquidity',
            args: [tokenA.address, tokenB.address, amountAWei, amountBWei, BigInt(0), BigInt(0), address, deadline],
            gas: gasLimit,
          });
        }, 100);
      } else if (permitStep === 'addLiquidity') {
        // 添加流动性完成
        setPermitStep('idle');
        reset();
      }
    }
  }, [isSuccess, permitStep, address]);

  // 一键完成：签名 + permit 交易 + 添加流动性
  const handleOneClickAddLiquidity = async () => {
    if (!address || !amountA || !amountB) return;
    
    // 检查是否需要签名（授权不足且没有有效签名）
    const needSignA = tokenA.supportsPermit && allowanceA < amountAWei && !hasValidPermitA;
    const needSignB = tokenB.supportsPermit && allowanceB < amountBWei && !hasValidPermitB;
    
    // 如果需要签名，先签名
    if (needSignA || needSignB) {
      await handleSignAndExecute();
      return; // 签名完成后，按钮会变成"执行授权并添加流动性"
    }
    
    // 检查是否需要执行 permit 交易（有有效签名且授权不足）
    const needPermitTxA = hasValidPermitA && permitSignatureA && allowanceA < amountAWei;
    const needPermitTxB = hasValidPermitB && permitSignatureB && allowanceB < amountBWei;
    
    // 如果有签名但还没执行 permit 交易，先执行 Token A
    if (needPermitTxA) {
      setPermitStep('permitA');
      writeContract({
        address: tokenA.address,
        abi: PERMIT_ABI,
        functionName: 'permit',
        args: [
          address,
          CONTRACTS.ROUTER,
          amountAWei,
          permitSignatureA.deadline,
          permitSignatureA.v,
          permitSignatureA.r,
          permitSignatureA.s,
        ],
      });
      return;
    }
    
    // Token A 不需要 permit，检查 Token B
    if (needPermitTxB) {
      setPermitStep('permitB');
      writeContract({
        address: tokenB.address,
        abi: PERMIT_ABI,
        functionName: 'permit',
        args: [
          address,
          CONTRACTS.ROUTER,
          amountBWei,
          permitSignatureB.deadline,
          permitSignatureB.v,
          permitSignatureB.r,
          permitSignatureB.s,
        ],
      });
      return;
    }
    
    // 两个代币都已授权，直接添加流动性
    handleAddLiquidity();
  };

  // 判断按钮状态和文字
  const getButtonState = () => {
    if (isPending || isConfirming || isSigningA || isSigningB) {
      if (isSigningA) return { disabled: true, text: `✍️ 签名 ${tokenA.symbol} 中...`, action: () => {} };
      if (isSigningB) return { disabled: true, text: `✍️ 签名 ${tokenB.symbol} 中...`, action: () => {} };
      if (permitStep === 'permitA') return { disabled: true, text: `执行 ${tokenA.symbol} 授权...`, action: () => {} };
      if (permitStep === 'permitB') return { disabled: true, text: `执行 ${tokenB.symbol} 授权...`, action: () => {} };
      return { disabled: true, text: '处理中...', action: () => {} };
    }
    if (!amountA || !amountB) {
      return { disabled: true, text: '请输入数量', action: () => {} };
    }
    
    // 检查余额
    if (hasInsufficientBalanceA) {
      return { disabled: true, text: `${tokenA.symbol} 余额不足`, action: () => {} };
    }
    if (hasInsufficientBalanceB) {
      return { disabled: true, text: `${tokenB.symbol} 余额不足`, action: () => {} };
    }
    
    // 如果禁用 Permit 或代币不支持，使用传统 approve
    if (!usePermit || !tokenA.supportsPermit || !tokenB.supportsPermit) {
      if (needsApprovalA) {
        return { disabled: false, text: `授权 ${tokenA.symbol}`, action: handleApproveA, isApproval: true };
      }
      if (needsApprovalB) {
        return { disabled: false, text: `授权 ${tokenB.symbol}`, action: handleApproveB, isApproval: true };
      }
      return { disabled: false, text: '添加流动性', action: handleAddLiquidity };
    }
    
    // 使用 Permit 签名流程
    // 检查是否需要签名（授权不足且没有有效签名）
    const needSignA = allowanceA < amountAWei && !hasValidPermitA;
    const needSignB = allowanceB < amountBWei && !hasValidPermitB;
    
    // 检查是否需要执行 permit 交易（有有效签名且授权不足）
    const needPermitTxA = hasValidPermitA && permitSignatureA && allowanceA < amountAWei;
    const needPermitTxB = hasValidPermitB && permitSignatureB && allowanceB < amountBWei;
    
    // 有签名待执行
    if (needPermitTxA || needPermitTxB) {
      return { disabled: false, text: '🚀 执行授权并添加流动性', action: handleOneClickAddLiquidity, isPermit: true };
    }
    
    // 需要签名
    if (needSignA || needSignB) {
      return { disabled: false, text: '✍️ 一键签名授权', action: handleOneClickAddLiquidity, isApproval: true, isPermit: true };
    }
    
    return { disabled: false, text: '添加流动性', action: handleAddLiquidity };
  };

  const buttonState = getButtonState();

  return (
    <div className="card">
      <h3>➕ 添加流动性</h3>

      <div className="liquidity-container">
        <div className="input-group">
          <div className="input-label-row">
            <label>Token A</label>
            <span className="balance-hint">
              余额: {parseFloat(formatUnits(balanceA, 18)).toFixed(4)}
              {!needsApprovalA && amountA && <span className="approved-badge">✓ 已授权</span>}
            </span>
          </div>
          <div className="input-row">
            <input
              type="number"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
              className={hasInsufficientBalanceA ? 'input-error' : ''}
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
        </div>

        <div className="plus-sign">+</div>

        <div className="input-group">
          <div className="input-label-row">
            <label>Token B</label>
            <span className="balance-hint">
              余额: {parseFloat(formatUnits(balanceB, 18)).toFixed(4)}
              {!needsApprovalB && amountB && <span className="approved-badge">✓ 已授权</span>}
            </span>
          </div>
          <div className="input-row">
            <input
              type="number"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.1"
              className={hasInsufficientBalanceB ? 'input-error' : ''}
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
        </div>

        
        {/* 交易对状态提示 */}
        {amountA && amountB && (
          <div className={`pair-status ${pairExists ? 'exists' : 'new'}`}>
            {pairExists ? (
              <>✅ 交易对已存在 <span className="gas-hint">(预估 Gas: ~200k)</span></>
            ) : (
              <>🆕 将创建新交易对 <span className="gas-hint">(预估 Gas: ~2.5M)</span></>
            )}
          </div>
        )}

        {/* 授权状态提示 */}
        {amountA && amountB && (
          <div className="approval-status">
            <div className={`approval-item ${!needsApprovalA ? 'approved' : 'pending'}`}>
              {!needsApprovalA ? '✓' : hasValidPermitA ? '✍️' : '○'} {tokenA.symbol}
              {usePermit && tokenA.supportsPermit && <span className="permit-badge">Permit</span>}
            </div>
            <div className={`approval-item ${!needsApprovalB ? 'approved' : 'pending'}`}>
              {!needsApprovalB ? '✓' : hasValidPermitB ? '✍️' : '○'} {tokenB.symbol}
              {usePermit && tokenB.supportsPermit && <span className="permit-badge">Permit</span>}
            </div>
          </div>
        )}

        <button
          onClick={buttonState.action}
          disabled={buttonState.disabled}
          className={`btn ${buttonState.isApproval ? 'btn-secondary' : 'btn-primary'}`}
        >
          {buttonState.text}
        </button>

        {isSuccess && !lastApprovedToken && (
          <div className="success-message">
            ✅ 添加流动性成功!{' '}
            <a
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看交易
            </a>
            <button onClick={() => refetchTokenData()} className="btn btn-secondary btn-sm">
              刷新状态
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
