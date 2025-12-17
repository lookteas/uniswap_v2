// 代币配置 - 可扩展添加更多代币
export interface Token {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
}

// Sepolia 测试网代币列表
export const TOKENS: Token[] = [
  {
    address: '0x3aBe45b63e723eF24680afeA45B98D51bd398Bdd',
    symbol: 'TKA',
    name: 'Token A',
    decimals: 18,
  },
  {
    address: '0x64e6775b20Ed22ec10bca887400E6F5790112e75',
    symbol: 'TKB',
    name: 'Token B',
    decimals: 18,
  },
  {
    address: '0x0e9150b7ae7587Fb509Ba585268fc379C1da79Ba',
    symbol: 'TKC',
    name: 'Token C',
    decimals: 18,
  },
  {
    address: '0x2141b1565C5d1FF548Cb81d53b8B3F09A1099651',
    symbol: 'TKD',
    name: 'Token D',
    decimals: 18,
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
