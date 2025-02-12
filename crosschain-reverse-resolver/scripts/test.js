import { serve } from '@resolverworks/ezccip/serve';
import { EthSelfRollup, Gateway } from '@unruggable/gateways';
import { createAnvil } from '@viem/anvil';
import { fork } from 'child_process';
import { JsonRpcProvider } from 'ethers';

const anvil = createAnvil();
await anvil.start();

const provider = new JsonRpcProvider(`http://${anvil.host}:${anvil.port}`);

const rollup = new EthSelfRollup(provider);
rollup.latestBlockTag = 'latest';
const gateway = new Gateway(rollup);
const ccip = await serve(gateway, { protocol: 'raw', log: true });

console.log('Starting hardhat');
const code = await new Promise((resolve) => {
  const hh = fork(
    '../node_modules/.bin/hardhat',
    ['test', '--network', 'anvil'],
    {
      stdio: 'inherit',
      env: {
        NODE_OPTIONS: '--experimental-loader ts-node/esm/transpile-only',
        RPC_PORT: anvil.port.toString(),
        SERVER_PORT: ccip.port.toString(),
        ROLLUP_DEFAULT_WINDOW: rollup.defaultWindow.toString(),
        TESTS_PATH: './test',
      },
    }
  );
  hh.on('close', (c) => resolve(c ?? 0));
});

console.log('Shutting down');
await Promise.all([ccip.shutdown(), anvil.stop()]);
process.exit(code);
