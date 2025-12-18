// 代币配置 - 可扩展添加更多代币
export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  supportsPermit: boolean; // 是否支持 ERC-2612 Permit
  isNative?: boolean; // 是否是原生代币包装（如 WETH）
}

// Sepolia WETH 地址
export const WETH_ADDRESS = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9' as const;

// Sepolia 测试网代币列表
export const TOKENS: Token[] = [
  {
    address: WETH_ADDRESS,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    supportsPermit: false,
    isNative: true,
  },
  {
    address: '0x89349c29eAb08674Ccb243aEf113c28847fB5215',
    symbol: 'TKA',
    name: 'Token A',
    decimals: 18,
    supportsPermit: true,
  },
  {
    address: '0x92e90F895172CDc96BB0985BC56f0cA4874aEd79',
    symbol: 'TKB',
    name: 'Token B',
    decimals: 18,
    supportsPermit: true,
  },
  {
    address: '0x7Ca1a37CD0dE6f2bf06c09Da57bEa14344BfBa25',
    symbol: 'TKC',
    name: 'Token C',
    decimals: 18,
    supportsPermit: true,
  },
  {
    address: '0x4dDCabc42aAF3403e300413F3b8AD909F58785b1',
    symbol: 'TKD',
    name: 'Token D',
    decimals: 18,
    supportsPermit: true,
  },
  {
    address: '0xC47941810E359DB426f5c4a3487e3110172283c6',
    symbol: 'TKE',
    name: 'Token E',
    decimals: 18,
    supportsPermit: true,
  },
];

// 根据地址获取代币信息
export function getTokenByAddress(address: string): Token | undefined {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

// 根据符号获取代币信息
export function getTokenBySymbol(symbol: string): Token | undefined {
  return TOKENS.find(t => t.symbol === symbol);
}
