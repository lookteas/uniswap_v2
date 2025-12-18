import { useState, useEffect } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSignTypedData, useChainId } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, ERC20_ABI, FACTORY_ABI, PERMIT2_ROUTER_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';

// Permit2 SignatureTransfer 类型定义
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
} as const;

export function AddLiquidityPermit2() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [tokenAIndex, setTokenAIndex] = useState(0);
  const [tokenBIndex, setTokenBIndex] = useState(1);
  const [isSigningA, setIsSigningA] = useState(false);
  const [isSigningB, setIsSigningB] = useState(false);
  const [permit2NonceBase, setPermit2NonceBase] = useState(() => BigInt(Date.now()));

  const tokenA = TOKENS[tokenAIndex];
  const tokenB = TOKENS[tokenBIndex];

  // 查询代币余额和对 Permit2 的授权
  const { data: tokenData, refetch: refetchTokenData } = useReadContracts({
    contracts: [
      // Token A 余额
      {
        address: tokenA?.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      // Token B 余额
      {
        address: tokenB?.address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      // Token A 对 Permit2 的授权
      {
        address: tokenA?.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, CONTRACTS.PERMIT2],
      },
      // Token B 对 Permit2 的授权
      {
        address: tokenB?.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, CONTRACTS.PERMIT2],
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

  // 交易成功后刷新
  useEffect(() => {
    if (isSuccess) {
      refetchTokenData();
      setPermit2NonceBase((prev) => prev + BigInt(2));
      // 延迟重置，让用户看到成功提示
      setTimeout(() => reset(), 3000);
    }
  }, [isSuccess, refetchTokenData, reset]);

  // 切换代币时重置状态
  useEffect(() => {
    reset();
    setAmountA('');
    setAmountB('');
  }, [tokenAIndex, tokenBIndex, reset]);

  const amountAWei = amountA ? parseUnits(amountA, 18) : BigInt(0);
  const amountBWei = amountB ? parseUnits(amountB, 18) : BigInt(0);

  const balanceA = (tokenData?.[0]?.result as bigint) ?? BigInt(0);
  const balanceB = (tokenData?.[1]?.result as bigint) ?? BigInt(0);
  const permit2AllowanceA = (tokenData?.[2]?.result as bigint) ?? BigInt(0);
  const permit2AllowanceB = (tokenData?.[3]?.result as bigint) ?? BigInt(0);
  const pairAddress = (tokenData?.[4]?.result as `0x${string}`) ?? '0x0000000000000000000000000000000000000000';
  
  const pairExists = pairAddress !== '0x0000000000000000000000000000000000000000';
  const gasLimit = pairExists ? BigInt(500000) : BigInt(3500000);

  const hasInsufficientBalanceA = amountAWei > balanceA;
  const hasInsufficientBalanceB = amountBWei > balanceB;
  
  // 检查是否需要授权给 Permit2
  const needsPermit2ApprovalA = permit2AllowanceA < amountAWei;
  const needsPermit2ApprovalB = permit2AllowanceB < amountBWei;

  // 授权代币给 Permit2（一次性，无限额度）
  const handleApproveToPermit2 = (token: 'A' | 'B') => {
    const tokenAddress = token === 'A' ? tokenA.address : tokenB.address;
    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.PERMIT2, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
  };

  // 签名并添加流动性（一笔交易）
  const handleSignAndAddLiquidity = async () => {
    if (!address || !amountA || !amountB) return;
    
    setIsSigningA(true);
    setIsSigningB(true);
    
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 分钟
      const nonceA = permit2NonceBase;
      const nonceB = permit2NonceBase + BigInt(1);
      
      // Permit2 domain
      const permit2Domain = {
        name: 'Permit2',
        chainId: chainId,
        verifyingContract: CONTRACTS.PERMIT2,
      };
      
      // 签名 Token A
      const signatureA = await signTypedDataAsync({
        domain: permit2Domain,
        types: PERMIT2_TRANSFER_TYPES,
        primaryType: 'PermitTransferFrom',
        message: {
          permitted: {
            token: tokenA.address,
            amount: amountAWei,
          },
          spender: CONTRACTS.PERMIT2_ROUTER,
          nonce: nonceA,
          deadline: deadline,
        },
      });
      setIsSigningA(false);
      
      // 签名 Token B
      const signatureB = await signTypedDataAsync({
        domain: permit2Domain,
        types: PERMIT2_TRANSFER_TYPES,
        primaryType: 'PermitTransferFrom',
        message: {
          permitted: {
            token: tokenB.address,
            amount: amountBWei,
          },
          spender: CONTRACTS.PERMIT2_ROUTER,
          nonce: nonceB,
          deadline: deadline,
        },
      });
      setIsSigningB(false);
      
      // 调用 Permit2Router 添加流动性
      writeContract({
        address: CONTRACTS.PERMIT2_ROUTER,
        abi: PERMIT2_ROUTER_ABI,
        functionName: 'addLiquidityWithPermit2',
        args: [
          {
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            amountA: amountAWei,
            amountB: amountBWei,
            amountAMin: BigInt(0),
            amountBMin: BigInt(0),
            to: address,
            deadline: deadline,
          },
          {
            nonceA: nonceA,
            nonceB: nonceB,
            signatureA: signatureA,
            signatureB: signatureB,
          },
        ],
        gas: gasLimit,
      });
    } catch (error) {
      console.error('Permit2 signing failed:', error);
      setIsSigningA(false);
      setIsSigningB(false);
    }
  };

  // 判断按钮状态
  const getButtonState = () => {
    if (isPending || isConfirming || isSigningA || isSigningB) {
      if (isSigningA) return { disabled: true, text: `✍️ 签名 ${tokenA.symbol} 中...` };
      if (isSigningB) return { disabled: true, text: `✍️ 签名 ${tokenB.symbol} 中...` };
      return { disabled: true, text: '处理中...' };
    }
    if (!amountA || !amountB) {
      return { disabled: true, text: '请输入数量' };
    }
    if (hasInsufficientBalanceA) {
      return { disabled: true, text: `${tokenA.symbol} 余额不足` };
    }
    if (hasInsufficientBalanceB) {
      return { disabled: true, text: `${tokenB.symbol} 余额不足` };
    }
    
    // 检查是否需要授权给 Permit2
    if (needsPermit2ApprovalA) {
      return { 
        disabled: false, 
        text: `授权 ${tokenA.symbol} 给 Permit2`, 
        action: () => handleApproveToPermit2('A'),
        isApproval: true,
      };
    }
    if (needsPermit2ApprovalB) {
      return { 
        disabled: false, 
        text: `授权 ${tokenB.symbol} 给 Permit2`, 
        action: () => handleApproveToPermit2('B'),
        isApproval: true,
      };
    }
    
    // 都已授权，可以签名并添加流动性
    return { 
      disabled: false, 
      text: '✍️ 签名并添加流动性', 
      action: handleSignAndAddLiquidity,
      isPermit2: true,
    };
  };

  const buttonState = getButtonState();

  return (
    <div className="card">
      <div className="card-header">
        <h3>➕ 添加流动性 <span className="permit2-badge">Permit2</span></h3>
      </div>

      <div className="swap-container">
        <div className="input-group">
          <label>Token A</label>
          <div className="input-row">
            <input
              type="number"
              placeholder="0.0"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
            />
            <select 
              value={tokenAIndex} 
              onChange={(e) => setTokenAIndex(Number(e.target.value))}
            >
              {TOKENS.map((token, index) => (
                <option key={token.address} value={index} disabled={index === tokenBIndex}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
          <small className="balance-hint">
            余额: {parseFloat(formatUnits(balanceA, 18)).toFixed(4)} {tokenA.symbol}
            {!needsPermit2ApprovalA && amountA && <span className="approved-badge"> ✓ Permit2</span>}
          </small>
        </div>

        <div className="swap-arrow">+</div>

        <div className="input-group">
          <label>Token B</label>
          <div className="input-row">
            <input
              type="number"
              placeholder="0.0"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
            />
            <select 
              value={tokenBIndex} 
              onChange={(e) => setTokenBIndex(Number(e.target.value))}
            >
              {TOKENS.map((token, index) => (
                <option key={token.address} value={index} disabled={index === tokenAIndex}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
          <small className="balance-hint">
            余额: {parseFloat(formatUnits(balanceB, 18)).toFixed(4)} {tokenB.symbol}
            {!needsPermit2ApprovalB && amountB && <span className="approved-badge"> ✓ Permit2</span>}
          </small>
        </div>

        {/* 交易对状态提示 */}
        {amountA && amountB && (
          <div className="swap-info">
            <p>{pairExists ? '✅ 交易对已存在' : '🆕 将创建新交易对'}</p>
            <p>预估 Gas: {pairExists ? '~300k' : '~3M'}</p>
          </div>
        )}

        <button
          onClick={buttonState.action}
          disabled={buttonState.disabled}
          className="btn btn-action"
        >
          {buttonState.text}
        </button>

        {isSuccess && (
          <div className="success-message">
            ✅ 流动性添加成功！{' '}
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
