import type { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-verify';
import '@nomicfoundation/hardhat-viem';

import '@ensdomains/hardhat-toolbox-viem-extended';

import dotenv from 'dotenv';
import 'hardhat-storage-layout';
import './tasks/esm_fix.cjs';
import './tasks/getname.cjs';
import './tasks/set_resolvers.cjs';
import './tasks/transaction.cjs';

dotenv.config();

import('@ensdomains/hardhat-chai-matchers-viem');

const realAccounts = process.env.DEPLOYER_KEY
  ? [
      process.env.DEPLOYER_KEY,
      process.env.OWNER_KEY ?? process.env.DEPLOYER_KEY,
    ]
  : [];

const config = {
  solidity: {
    version: '0.8.25',
    settings: {
      evmVersion: 'cancun',
      optimizer: {
        enabled: true,
        runs: 1_000_000,
      },
      metadata: {
        useLiteralContent: true,
      },
    },
  },
  networks: {
    anvil: {
      url: `http://localhost:${parseInt(process.env['RPC_PORT'] || '8545')}`,
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      chainId: 11155111,
      accounts: realAccounts,
    },
    optimismSepolia: {
      url: 'https://sepolia.optimism.io',
      chainId: 11155420,
      accounts: realAccounts,
      companionNetworks: {
        l1: 'sepolia',
      },
    },
    baseSepolia: {
      url: 'https://sepolia.base.org',
      chainId: 84532,
      accounts: realAccounts,
      companionNetworks: {
        l1: 'sepolia',
      },
    },
    arbitrumSepolia: {
      url: 'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      accounts: realAccounts,
      companionNetworks: {
        l1: 'sepolia',
      },
    },
    scroll: {
      url: 'https://rpc.scroll.io',
      chainId: 534352,
      accounts: realAccounts,
      companionNetworks: {
        l1: 'sepolia',
      },
    },
    scrollSepolia: {
      url: 'https://sepolia-rpc.scroll.io',
      chainId: 534351,
      accounts: realAccounts,
      companionNetworks: {
        l1: 'sepolia',
      },
    },
    lineaSepolia: {
      url: 'https://rpc.sepolia.linea.build',
      chainId: 59141,
      accounts: realAccounts,
      companionNetworks: {
        l1: 'sepolia',
      },
    },
  },
  paths: {
    tests: process.env.TESTS_PATH ?? 'test/unit',
  },
  external: {
    contracts: [
      {
        artifacts: '../node_modules/@unruggable/gateways/artifacts',
      },
    ],
  },
} satisfies HardhatUserConfig;

declare module '@nomicfoundation/hardhat-viem/types.js' {
  interface Register {
    config: typeof config;
  }
}

export default config;
