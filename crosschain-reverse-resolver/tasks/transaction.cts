import config = require('hardhat/config');
import consts = require('./consts.cjs');

config
  .task(
    'set-name',
    "Sets a name on an L2's ReverseRegistrar (or DefaultReverseRegistrar)"
  )
  .addPositionalParam('name', 'ENS name to set as primary')
  .setAction(async (args, hre) => {
    const name = args.name as string;
    const chainId = hre.network.config.chainId!;
    const reverseRegistrarAddress =
      consts.reverseRegistrarAddresses[
        chainId as keyof typeof consts.reverseRegistrarAddresses
      ];
    if (!reverseRegistrarAddress)
      throw new Error(`ReverseRegistrar not found for chain ${chainId}`);

    const [walletClient] = await hre.viem.getWalletClients();

    const l2ReverseRegistrar = await hre.viem.getContractAt(
      'L2ReverseRegistrar',
      reverseRegistrarAddress
    );

    console.log(
      `Setting ${args.name} as primary for ${walletClient.account.address} on ${reverseRegistrarAddress}`
    );

    const txHash = await l2ReverseRegistrar.write.setName([name]);
    console.log(`Transaction hash: ${txHash}`);
    await hre.viem.waitForTransactionSuccess(txHash);

    const nameRecord = await l2ReverseRegistrar.read.nameForAddr([
      walletClient.account.address,
    ]);
    console.log(`Name record: ${nameRecord}`);
  });
