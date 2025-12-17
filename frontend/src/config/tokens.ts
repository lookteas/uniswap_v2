// 代币配置 - 可扩展添加更多代币
export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  supportsPermit: boolean; // 是否支持 ERC-2612 Permit
}

// Sepolia 测试网代币列表
export const TOKENS: Token[] = [
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
];

// 根据地址获取代币信息
export function getTokenByAddress(address: string): Token | undefined {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());
}

// 根据符号获取代币信息
export function getTokenBySymbol(symbol: string): Token | undefined {
  return TOKENS.find(t => t.symbol === symbol);
}
