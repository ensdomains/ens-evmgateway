import type { HardhatUserConfig } from 'hardhat/config';

import '@nomicfoundation/hardhat-verify';
import '@nomicfoundation/hardhat-viem';
import 'hardhat-storage-layout';
import './tasks/esm_fix.cjs';

import('@ensdomains/hardhat-chai-matchers-viem');

const config = {
  solidity: {
    version: '0.8.19',
    settings: {
      metadata: {
        useLiteralContent: true,
      },
    },
  },
  networks: {
    anvil: {
      url: `http://localhost:${parseInt(process.env['RPC_PORT'] || '8545')}`,
    },
  },
} satisfies HardhatUserConfig;

export default config;
