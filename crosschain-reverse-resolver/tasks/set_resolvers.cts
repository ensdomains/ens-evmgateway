import config = require('hardhat/config');
import consts = require('./consts.cjs');
import Safe, {
  type ContractNetworkConfig,
  type CreateTransactionProps,
} from '@safe-global/protocol-kit';
import {
  encodeFunctionData,
  labelhash,
  namehash,
  zeroAddress,
  type Hash,
} from 'viem';

const ensRegistryAddress = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const testnetSafeAddress = '0x343431e9CEb7C19cC8d3eA0EE231bfF82B584910';

config
  .task('set-resolvers', 'Sets the resolvers for a chain')
  .setAction(async (_args, hre) => {
    const { getReverseLabelByChainId, getReverseNamespace } = await import(
      '../test/utils.js'
    );
    const ensRegistry = await hre.viem.getContractAt(
      'ENSRegistry',
      ensRegistryAddress
    );

    const provider = await hre.viem.getPublicClient();
    const privateKey = process.env.SAFE_PROPOSER_KEY!;
    const protocolKit = await Safe.init({
      provider: provider.transport,
      signer: privateKey,
      safeAddress: testnetSafeAddress,
      contractNetworks: {
        [hre.network.config.chainId!]: {
          createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
          fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
          multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
          multiSendCallOnlyAddress:
            '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
          safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
          safeSingletonAddress: '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762',
        } as ContractNetworkConfig,
      },
    });

    const safeTransactions: CreateTransactionProps['transactions'] = [];

    const reverseOwner = await ensRegistry.read.owner([namehash('reverse')]);

    if (reverseOwner !== testnetSafeAddress)
      throw new Error('Reverse owner is not the testnet safe address');

    // default reverse
    const defaultReverseNode = namehash('default.reverse');
    const defaultReverseRegistrarAddress =
      consts.defaultReverseRegistrarAddresses[
        hre.network.config
          .chainId! as keyof typeof consts.defaultReverseRegistrarAddresses
      ];

    const defaultReverseCurrentResolver = await ensRegistry.read.resolver([
      defaultReverseNode,
    ]);
    if (defaultReverseCurrentResolver !== defaultReverseRegistrarAddress) {
      console.log(
        `Will set default reverse registrar to ${defaultReverseRegistrarAddress}...`
      );
      safeTransactions.push({
        to: ensRegistryAddress,
        data: encodeFunctionData({
          abi: ensRegistry.abi,
          functionName: 'setSubnodeRecord',
          args: [
            namehash('reverse'),
            labelhash('default'),
            zeroAddress,
            defaultReverseRegistrarAddress,
            0n,
          ],
        }),
        value: '0',
      });
    } else console.log('Default reverse registrar is already set, skipping...');

    const supportedChains =
      consts.supportedChains[
        hre.network.config.chainId! as keyof typeof consts.supportedChains
      ];
    for (const chainId of supportedChains) {
      const resolverName = consts.chainIdToResolverName[chainId];
      const contract = await hre.viem.getContract(
        resolverName as 'L1ReverseResolver'
      );
      const reverseNamespace = getReverseNamespace({ chainId });

      const currentValue = await ensRegistry.read.resolver([
        namehash(reverseNamespace),
      ]);
      if (currentValue !== contract.address) {
        console.log(`Will set ${reverseNamespace} to ${contract.address}...`);
        safeTransactions.push({
          to: ensRegistryAddress,
          data: encodeFunctionData({
            abi: ensRegistry.abi,
            functionName: 'setSubnodeRecord',
            args: [
              namehash('reverse'),
              labelhash(getReverseLabelByChainId(chainId)),
              zeroAddress,
              contract.address,
              0n,
            ],
          }),
          value: '0',
        });
      } else
        console.log(
          `${reverseNamespace} (chainId: ${chainId}) is already set to ${currentValue}, skipping...`
        );
    }

    if (safeTransactions.length === 0)
      throw new Error('No transactions to send');

    const safeTransaction = await protocolKit.createTransaction({
      transactions: safeTransactions,
    });

    await new Promise((resolve) => setTimeout(resolve, 10_000));

    const safeTransactionHash =
      await protocolKit.getTransactionHash(safeTransaction);
    const signature = await protocolKit.signHash(safeTransactionHash);
    safeTransaction.addSignature(signature);

    const { hash } = await protocolKit.executeTransaction(safeTransaction);
    console.log(`Transaction hash: ${hash}`);
    const receipt = await provider.waitForTransactionReceipt({
      hash: hash as Hash,
    });
    if (receipt.status !== 'success') throw new Error('Transaction failed');

    console.log('Transactions sent successfully');
  });
