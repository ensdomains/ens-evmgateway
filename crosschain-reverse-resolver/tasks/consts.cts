import chains = require('viem/chains');

export const defaultReverseRegistrarAddresses = {
  [chains.sepolia.id]: '0x089C3F89e6eE8bAc40aFA96267a1c84003109d1b',
} as const;

export const reverseRegistrarAddresses = {
  [chains.sepolia.id]: defaultReverseRegistrarAddresses[chains.sepolia.id],
  [chains.optimismSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.baseSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.arbitrumSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.scrollSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
  [chains.lineaSepolia.id]: '0x00000BeEF055f7934784D6d81b6BC86665630dbA',
} as const;

export const chainIdToResolverName = {
  [chains.optimismSepolia.id]: 'OptimismL1ReverseResolver',
  [chains.baseSepolia.id]: 'BaseL1ReverseResolver',
  [chains.arbitrumSepolia.id]: 'ArbitrumL1ReverseResolver',
  [chains.scrollSepolia.id]: 'ScrollL1ReverseResolver',
  [chains.lineaSepolia.id]: 'LineaL1ReverseResolver',
} as const;

export const supportedChains = {
  [chains.sepolia.id]: [
    chains.optimismSepolia.id,
    chains.baseSepolia.id,
    chains.arbitrumSepolia.id,
    chains.scrollSepolia.id,
    chains.lineaSepolia.id,
  ],
} as const;
