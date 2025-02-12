import chains = require('viem/chains');

export const reverseRegistrarAddresses = {
  [chains.sepolia.id]: '0x089C3F89e6eE8bAc40aFA96267a1c84003109d1b',
  [chains.optimismSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.baseSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.arbitrumSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.scrollSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.lineaSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
} as const;
