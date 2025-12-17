import { useCallback } from 'react';
import { useAccount, useChainId, useReadContracts, useSignTypedData } from 'wagmi';
import { PERMIT_ABI } from '../config/contracts';

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

export interface PermitSignature {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  deadline: bigint;
  value: bigint;
}

interface UsePermitProps {
  tokenAddress: `0x${string}`;
  spenderAddress: `0x${string}`;
  amount: bigint;
  enabled?: boolean;
}

export function usePermit({ tokenAddress, spenderAddress, amount, enabled = true }: UsePermitProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();

  // 查询 nonce 和 token name
  const { data: permitData, refetch: refetchPermitData } = useReadContracts({
    contracts: [
      {
        address: tokenAddress,
        abi: PERMIT_ABI,
        functionName: 'nonces',
        args: [address!],
      },
      {
        address: tokenAddress,
        abi: PERMIT_ABI,
        functionName: 'name',
      },
      {
        address: tokenAddress,
        abi: PERMIT_ABI,
        functionName: 'DOMAIN_SEPARATOR',
      },
    ],
    query: { enabled: enabled && !!address && !!tokenAddress },
  });

  const nonce = (permitData?.[0]?.result as bigint) ?? BigInt(0);
  const tokenName = (permitData?.[1]?.result as string) ?? '';

  const signPermit = useCallback(async (): Promise<PermitSignature | null> => {
    if (!address || !tokenAddress || !spenderAddress || amount <= BigInt(0)) {
      return null;
    }

    try {
      // 设置 deadline 为 30 分钟后
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

      // 构建 EIP-712 domain
      const domain = {
        name: tokenName,
        version: '1',
        chainId: chainId,
        verifyingContract: tokenAddress,
      };

      // 构建 permit message
      const message = {
        owner: address,
        spender: spenderAddress,
        value: amount,
        nonce: nonce,
        deadline: deadline,
      };

      // 签名
      const signature = await signTypedDataAsync({
        domain,
        types: PERMIT_TYPES,
        primaryType: 'Permit',
        message,
      });

      // 解析签名
      const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
      const v = parseInt(signature.slice(130, 132), 16);

      return {
        v,
        r,
        s,
        deadline,
        value: amount,
      };
    } catch (error) {
      console.error('Permit signing failed:', error);
      return null;
    }
  }, [address, tokenAddress, spenderAddress, amount, tokenName, chainId, nonce, signTypedDataAsync]);

  return {
    signPermit,
    nonce,
    tokenName,
    refetchPermitData,
  };
}
