import { useReadContracts } from 'wagmi';
import { CONTRACTS, FACTORY_ABI, ROUTER_ABI } from '../config/contracts';
import { TOKENS, type Token } from '../config/tokens';
import { parseUnits } from 'viem';

export interface SwapPath {
  path: Token[];
  addresses: `0x${string}`[];
  amountOut: bigint;
}

// 生成所有可能的路径 (最多 4 跳)
export function generatePaths(tokenIn: Token, tokenOut: Token, allTokens: Token[]): Token[][] {
  const paths: Token[][] = [];
  
  // 直接路径: A -> B (1 跳)
  paths.push([tokenIn, tokenOut]);
  
  // 2 跳路径: A -> X -> B
  for (const mid of allTokens) {
    if (mid.address !== tokenIn.address && mid.address !== tokenOut.address) {
      paths.push([tokenIn, mid, tokenOut]);
    }
  }
  
  // 3 跳路径: A -> X -> Y -> B
  for (const mid1 of allTokens) {
    if (mid1.address === tokenIn.address || mid1.address === tokenOut.address) continue;
    for (const mid2 of allTokens) {
      if (
        mid2.address === tokenIn.address ||
        mid2.address === tokenOut.address ||
        mid2.address === mid1.address
      ) continue;
      paths.push([tokenIn, mid1, mid2, tokenOut]);
    }
  }
  
  // 4 跳路径: A -> X -> Y -> Z -> B
  for (const mid1 of allTokens) {
    if (mid1.address === tokenIn.address || mid1.address === tokenOut.address) continue;
    for (const mid2 of allTokens) {
      if (
        mid2.address === tokenIn.address ||
        mid2.address === tokenOut.address ||
        mid2.address === mid1.address
      ) continue;
      for (const mid3 of allTokens) {
        if (
          mid3.address === tokenIn.address ||
          mid3.address === tokenOut.address ||
          mid3.address === mid1.address ||
          mid3.address === mid2.address
        ) continue;
        paths.push([tokenIn, mid1, mid2, mid3, tokenOut]);
      }
    }
  }
  
  return paths;
}

// 将 Token 数组转换为地址数组
export function pathToAddresses(path: Token[]): `0x${string}`[] {
  return path.map(t => t.address);
}

// 格式化路径显示
export function formatPath(path: Token[]): string {
  return path.map(t => t.symbol).join(' → ');
}

// Hook: 查找最优路径
export function usePathFinder(
  tokenIn: Token | undefined,
  tokenOut: Token | undefined,
  amountIn: string
) {
  const allTokens = TOKENS;
  
  // 生成所有可能的路径
  const possiblePaths = tokenIn && tokenOut 
    ? generatePaths(tokenIn, tokenOut, allTokens)
    : [];
  
  // 为每条路径构建 getAmountsOut 调用
  const amountInWei = amountIn && parseFloat(amountIn) > 0 
    ? parseUnits(amountIn, 18) 
    : BigInt(0);
  
  const contracts = possiblePaths.map(path => ({
    address: CONTRACTS.ROUTER as `0x${string}`,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut' as const,
    args: [amountInWei, pathToAddresses(path)] as const,
  }));
  
  const { data, isLoading, error } = useReadContracts({
    contracts,
    query: {
      enabled: possiblePaths.length > 0 && amountInWei > BigInt(0),
    },
  });
  
  // 解析结果，找出最优路径
  const validPaths: SwapPath[] = [];
  
  if (data) {
    data.forEach((result, index) => {
      if (result.status === 'success' && result.result) {
        const amounts = result.result as bigint[];
        const amountOut = amounts[amounts.length - 1];
        validPaths.push({
          path: possiblePaths[index],
          addresses: pathToAddresses(possiblePaths[index]),
          amountOut,
        });
      }
    });
  }
  
  // 按输出金额排序，最优路径在前
  validPaths.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));
  
  return {
    paths: validPaths,
    bestPath: validPaths[0] || null,
    isLoading,
    error,
  };
}

// Hook: 检查交易对是否存在
export function usePairExists(tokenA: string, tokenB: string) {
  const { data } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.FACTORY as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenA as `0x${string}`, tokenB as `0x${string}`],
      },
    ],
    query: {
      enabled: !!tokenA && !!tokenB,
    },
  });
  
  const pairAddress = data?.[0]?.result as `0x${string}` | undefined;
  const exists = pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000';
  
  return { exists, pairAddress };
}
