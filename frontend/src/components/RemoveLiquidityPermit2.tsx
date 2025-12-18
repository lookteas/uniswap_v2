import { useState, useEffect } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId, useSignTypedData } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, PAIR_ABI, FACTORY_ABI, ERC20_ABI, PERMIT2_ROUTER_ABI } from '../config/contracts';
import { TOKENS } from '../config/tokens';

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

export function RemoveLiquidityPermit2() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState('');
  const [tokenAIndex, setTokenAIndex] = useState(0);
  const [tokenBIndex, setTokenBIndex] = useState(1);
  const [permit2Nonce, setPermit2Nonce] = useState(BigInt(Date.now()));
  const [isSigning, setIsSigning] = useState(false);

  const tokenA = TOKENS[tokenAIndex];
  const tokenB = TOKENS[tokenBIndex];

  const { signTypedDataAsync } = useSignTypedData();

  // 查询交易对地址
  const { data: pairAddressData } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair' as const,
        args: [tokenA?.address, tokenB?.address],
      },
    ],
    query: { enabled: !!tokenA && !!tokenB },
  });

  const pairAddress = pairAddressData?.[0]?.result as `0x${string}` | undefined;
  const hasPair = pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000';

  // 查询 LP 余额、Permit2 授权额度和储备
  const { data, refetch } = useReadContracts({
    contracts: [
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI,
        functionName: 'balanceOf',
        args: [address!],
      },
      {
        address: pairAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, CONTRACTS.PERMIT2],
      },
      {
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI,
        functionName: 'getReserves',
      },
    ],
    query: { enabled: !!address && !!hasPair },
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      refetch();
      setPermit2Nonce(prev => prev + BigInt(1));
      setTimeout(() => reset(), 3000);
    }
  }, [isSuccess, refetch, reset]);

  useEffect(() => {
    reset();
    setAmount('');
  }, [tokenAIndex, tokenBIndex, reset]);

  const lpBalance = (data?.[0]?.result as bigint) ?? BigInt(0);
  const permit2Allowance = (data?.[1]?.result as bigint) ?? BigInt(0);
  const rawReserves = data?.[2]?.result as [bigint, bigint, number] | undefined;
  const amountWei = amount ? parseUnits(amount, 18) : BigInt(0);

  const isTokenAFirst = tokenA && tokenB && tokenA.address.toLowerCase() < tokenB.address.toLowerCase();
  const reserveA = rawReserves ? (isTokenAFirst ? rawReserves[0] : rawReserves[1]) : undefined;
  const reserveB = rawReserves ? (isTokenAFirst ? rawReserves[1] : rawReserves[0]) : undefined;

  const needsPermit2Approval = permit2Allowance < amountWei;
  const hasInsufficientBalance = amountWei > lpBalance;

  const handleApproveToPermit2 = () => {
    if (!pairAddress) return;
    writeContract({
      address: pairAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.PERMIT2, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
  };

  const handleSignAndRemove = async () => {
    if (!address || !amount || !pairAddress) return;

    setIsSigning(true);

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

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
            token: pairAddress,
            amount: amountWei,
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
        functionName: 'removeLiquidityWithPermit2',
        args: [
          {
            tokenA: tokenA.address,
            tokenB: tokenB.address,
            liquidity: amountWei,
            amountAMin: BigInt(0),
            amountBMin: BigInt(0),
            to: address,
            deadline: deadline,
          },
          {
            nonce: permit2Nonce,
            signature: signature,
          },
        ],
        gas: BigInt(300000),
      });
    } catch (error) {
      console.error('签名失败:', error);
      setIsSigning(false);
    }
  };

  const setMaxAmount = () => {
    if (lpBalance > BigInt(0)) {
      setAmount(formatUnits(lpBalance, 18));
    }
  };

  const getButtonState = () => {
    if (!address) return { disabled: true, text: '请先连接钱包' };
    if (!hasPair) return { disabled: true, text: '交易对不存在' };
    if (!amount || parseFloat(amount) <= 0) return { disabled: true, text: '请输入数量' };
    if (hasInsufficientBalance) return { disabled: true, text: 'LP Token 余额不足' };
    if (needsPermit2Approval) return { disabled: false, text: '授权 LP Token 给 Permit2', action: 'approve' };
    if (isSigning) return { disabled: true, text: '✍️ 请在钱包中签名...' };
    if (isPending || isConfirming) return { disabled: true, text: '⏳ 交易处理中...' };
    return { disabled: false, text: '✍️ 签名并移除流动性', action: 'remove' };
  };

  const buttonState = getButtonState();

  return (
    <div className="card">
      <h3>➖ 移除流动性 <span className="permit2-badge">Permit2</span></h3>

      <div className="liquidity-container">
        <div className="pair-selector">
          <div className="input-group">
            <label>Token A</label>
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
          <span className="pair-separator">/</span>
          <div className="input-group">
            <label>Token B</label>
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

        {!hasPair && (
          <div className="no-pair-warning">
            ⚠️ 该交易对不存在
          </div>
        )}

        {hasPair && (
          <>
            <div className="lp-balance">
              <span>LP Token 余额: </span>
              <span className="balance-value">{parseFloat(formatUnits(lpBalance, 18)).toFixed(6)}</span>
              <button onClick={setMaxAmount} className="btn btn-link">
                MAX
              </button>
            </div>

            {reserveA && reserveB && (
              <div className="pool-info">
                <p>池子储备: {parseFloat(formatUnits(reserveA, 18)).toFixed(4)} {tokenA.symbol} / {parseFloat(formatUnits(reserveB, 18)).toFixed(4)} {tokenB.symbol}</p>
              </div>
            )}

            <div className="input-group">
              <label>移除数量 (LP Token)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.1"
              />
            </div>

            <button
              onClick={buttonState.action === 'approve' ? handleApproveToPermit2 : handleSignAndRemove}
              disabled={buttonState.disabled}
              className={`btn ${buttonState.action === 'remove' ? 'btn-permit2' : 'btn-danger'}`}
            >
              {buttonState.text}
            </button>
          </>
        )}

        {isSuccess && (
          <div className="success-message">
            ✅ 移除流动性成功!{' '}
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
