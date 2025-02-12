import config = require('hardhat/config');
import viem = require('viem');
import { type Address } from 'viem';
import consts = require('./consts.cjs');

const { encodeFunctionData, decodeFunctionResult, parseAbi, zeroHash } = viem;

const nameAbi = parseAbi(['function name(bytes32 node) view returns (string)']);

config
  .task('get-name', 'Gets the name for an address')
  .addPositionalParam('chain', 'Chain to get the name for')
  .addPositionalParam('address', 'Address to get the name for')
  .setAction(async (args, hre) => {
    const { getReverseNode, dnsEncodeName } = await import('../test/utils.js');

    const address = args.address as Address;
    const chainName = args.chain as string;

    const baseChainName = chainName.toLowerCase();
    const contractChainName = baseChainName.replace(/^\w/, (c) =>
      c.toUpperCase()
    );
    const l1ChainName = hre.network.name.replace(/^\w/, (c) => c.toUpperCase());
    const targetChainName = `${baseChainName}${l1ChainName}`;

    const targetChainId = hre.config.networks[targetChainName].chainId;

    if (!targetChainId) throw new Error(`Chain ${targetChainName} not found`);

    const l1ReverseResolver = await hre.viem.getContract(
      `${contractChainName}L1ReverseResolver` as 'L1ReverseResolver'
    );

    const reverseNode = getReverseNode(address, {
      chainId: targetChainId,
    });

    const calldata = encodeFunctionData({
      abi: nameAbi,
      functionName: 'name',
      args: [zeroHash],
    });

    const result = await l1ReverseResolver.read.resolve([
      dnsEncodeName(reverseNode),
      calldata,
    ]);
    const name = decodeFunctionResult({
      abi: nameAbi,
      functionName: 'name',
      data: result,
    });

    console.log(name);
  });

config
  .task('get-default-name', 'Gets the name for an address')
  .addPositionalParam('address', 'Address to get the name for')
  .setAction(async (args, hre) => {
    const address = args.address as Address;

    const defaultReverseRegistrar = await hre.viem.getContractAt(
      'DefaultReverseRegistrar',
      consts.reverseRegistrarAddresses[
        hre.network.config
          .chainId as keyof typeof consts.reverseRegistrarAddresses
      ]
    );

    const name = await defaultReverseRegistrar.read.nameForAddr([address]);

    console.log('result:', name);
  });

config
  .task('get-l2-name', 'Gets the name for an address')
  .addPositionalParam('address', 'Address to get the name for')
  .setAction(async (args, hre) => {
    const address = args.address as Address;

    const l2ReverseRegistrar = await hre.viem.getContractAt(
      'L2ReverseRegistrar',
      consts.reverseRegistrarAddresses[
        hre.network.config
          .chainId as keyof typeof consts.reverseRegistrarAddresses
      ]
    );

    const name = await l2ReverseRegistrar.read.nameForAddr([address]);

    console.log('result:', name);
  });
