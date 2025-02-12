import { shouldSupportInterfaces } from '@ensdomains/hardhat-chai-matchers-viem/behaviour';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox-viem/network-helpers.js';
import { expect } from 'chai';
import hre from 'hardhat';
import {
  createClient,
  custom,
  decodeFunctionResult,
  encodeFunctionData,
  getContract,
  keccak256,
  labelhash,
  namehash,
  parseAbi,
  stringToBytes,
  testActions,
  walletActions,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';
import { anvil } from 'viem/chains';

import { evmChainIdToCoinType } from '@ensdomains/address-encoder/utils';
import { deployContract, waitForTransactionReceipt } from 'viem/actions';
import { dnsEncodeName, getReverseNamespace, getReverseNode } from './utils.js';

const l2Name = 'vitalik.eth';
const defaultName = 'default.eth';

const coinType = evmChainIdToCoinType(10) as bigint;
const namespaceLabel = coinType.toString(16);
const namespace = getReverseNamespace({ chainId: 10 });
const getNamespacedReverseNode = (address: Address) =>
  getReverseNode(address, { chainId: 10 });

async function fixture() {
  const transport = await hre.viem.getPublicClient().then((c) => c.transport);
  const accounts = await hre.viem
    .getWalletClients()
    .then((clients) => clients.map((c) => c.account));
  const client = createClient({
    transport: custom(transport, { retryCount: 0 }),
    account: accounts[0],
    chain: anvil,
  })
    .extend(testActions({ mode: 'anvil' }))
    .extend(walletActions);

  const customDeployHelper = async (
    contractName: string,
    constructorArgs: unknown[],
    libraries?: { [libraryName: string]: Address }
  ) => {
    const artifact = await hre.deployments.getArtifact(contractName);
    const bytecodeObj = artifact.bytecode as unknown as {
      object: Hex;
      linkReferences: {
        [sourceName: string]: {
          [libraryName: string]: { start: number; length: number }[];
        };
      };
    };

    let bytecode = bytecodeObj.object;
    if (libraries) {
      for (const [, libraryReferences] of Object.entries(
        bytecodeObj.linkReferences
      )) {
        for (const [libraryName, linkReferences] of Object.entries(
          libraryReferences
        )) {
          for (const { start, length } of linkReferences) {
            if (!(libraryName in libraries))
              throw new Error(`Library ${libraryName} not found in libraries`);
            const address = libraries[libraryName];
            bytecode =
              bytecode.substring(0, 2 + start * 2) +
              address.substring(2) +
              bytecode.substring(2 + (start + length) * 2);
          }
        }
      }
    }

    const txHash = await deployContract(client, {
      abi: artifact.abi,
      args: constructorArgs as never,
      bytecode,
    });
    const receipt = await waitForTransactionReceipt(client, { hash: txHash });
    return getContract({
      abi: artifact.abi,
      address: receipt.contractAddress!,
      client,
    });
  };

  // basic ens deploy
  const ensRegistry = await hre.viem.deployContract('ENSRegistry', []);

  await ensRegistry.write.setSubnodeOwner([
    zeroHash,
    labelhash('reverse'),
    accounts[0].address,
  ]);

  const gatewayVm = await customDeployHelper('GatewayVM', []);
  const ethVerifierHooks = await customDeployHelper('EthVerifierHooks', []);

  const l1Verifier = await customDeployHelper(
    'SelfVerifier',
    [
      [`http://0.0.0.0:${process.env.SERVER_PORT}`],
      parseInt(process.env.ROLLUP_DEFAULT_WINDOW!),
      ethVerifierHooks.address,
    ],
    {
      GatewayVM: gatewayVm.address,
    }
  );

  const defaultReverseRegistrar = await hre.viem.deployContract(
    'DefaultReverseRegistrar',
    []
  );
  const l2ReverseRegistrar = await hre.viem.deployContract(
    'L2ReverseRegistrar',
    [coinType]
  );
  const l1ReverseResolver = await hre.viem.deployContract('L1ReverseResolver', [
    accounts[0].address,
    ensRegistry.address,
    l1Verifier.address,
    l2ReverseRegistrar.address,
    keccak256(stringToBytes(namespace)),
    [`http://0.0.0.0:${process.env.SERVER_PORT}`],
  ]);

  await ensRegistry.write.setSubnodeRecord([
    namehash('reverse'),
    labelhash(namespaceLabel),
    accounts[0].address,
    l1ReverseResolver.address,
    0n,
  ]);
  await ensRegistry.write.setSubnodeRecord([
    namehash('reverse'),
    labelhash('default'),
    accounts[0].address,
    defaultReverseRegistrar.address,
    0n,
  ]);

  await l2ReverseRegistrar.write.setName(['null'], { account: accounts[9] });
  await client.mine({ blocks: 1 });

  const accountWithL2Name = accounts[0];
  const accountWithDefault = accounts[1];
  const accountWithoutName = accounts[2];

  await l2ReverseRegistrar.write.setName([l2Name], {
    account: accountWithL2Name,
  });
  await defaultReverseRegistrar.write.setName([defaultName], {
    account: accountWithDefault,
  });
  await client.mine({ blocks: 1 });

  return {
    client,
    accounts,
    accountWithL2Name,
    accountWithDefault,
    accountWithoutName,
    ensRegistry: getContract({
      abi: ensRegistry.abi,
      address: ensRegistry.address,
      client,
    }),
    l1Verifier: getContract({
      abi: l1Verifier.abi,
      address: l1Verifier.address,
      client,
    }),
    defaultReverseRegistrar: getContract({
      abi: defaultReverseRegistrar.abi,
      address: defaultReverseRegistrar.address,
      client,
    }),
    l2ReverseRegistrar: getContract({
      abi: l2ReverseRegistrar.abi,
      address: l2ReverseRegistrar.address,
      client,
    }),
    l1ReverseResolver: getContract({
      abi: l1ReverseResolver.abi,
      address: l1ReverseResolver.address,
      client,
    }),
  };
}

const nameAbi = parseAbi(['function name(bytes32 node) view returns (string)']);

describe('ReverseResolver', () => {
  it('should resolve name that is set on l2', async () => {
    const { accountWithL2Name, l1ReverseResolver } = await loadFixture(fixture);

    const reverseNode = getNamespacedReverseNode(accountWithL2Name.address);
    const encodedL2ReverseName = dnsEncodeName(reverseNode);
    const nameCalldata = encodeFunctionData({
      abi: nameAbi,
      functionName: 'name',
      args: [namehash(reverseNode)],
    });

    const result = await l1ReverseResolver.read.resolve([
      encodedL2ReverseName,
      nameCalldata,
    ]);
    const decodedResult = decodeFunctionResult({
      abi: nameAbi,
      functionName: 'name',
      data: result,
    });

    expect(decodedResult).toBe(l2Name);
  });

  it('should resolve default if no name is set on l2', async () => {
    const { accountWithDefault, l1ReverseResolver } =
      await loadFixture(fixture);

    const reverseNode = getNamespacedReverseNode(accountWithDefault.address);
    const encodedL2ReverseName = dnsEncodeName(reverseNode);
    const nameCalldata = encodeFunctionData({
      abi: nameAbi,
      functionName: 'name',
      args: [namehash(reverseNode)],
    });

    const result = await l1ReverseResolver.read.resolve([
      encodedL2ReverseName,
      nameCalldata,
    ]);
    const decodedResult = decodeFunctionResult({
      abi: nameAbi,
      functionName: 'name',
      data: result,
    });

    expect(decodedResult).toBe(defaultName);
  });

  it('should resolve to null if no l2 or default name', async () => {
    const { accountWithoutName, l1ReverseResolver } =
      await loadFixture(fixture);

    const reverseNode = getNamespacedReverseNode(accountWithoutName.address);
    const encodedL2ReverseName = dnsEncodeName(reverseNode);
    const nameCalldata = encodeFunctionData({
      abi: nameAbi,
      functionName: 'name',
      args: [namehash(reverseNode)],
    });

    const result = await l1ReverseResolver.read.resolve([
      encodedL2ReverseName,
      nameCalldata,
    ]);
    const decodedResult = decodeFunctionResult({
      abi: nameAbi,
      functionName: 'name',
      data: result,
    });

    expect(decodedResult).toBe('');
  });

  shouldSupportInterfaces({
    contract: () => loadFixture(fixture).then((f) => f.l1ReverseResolver),
    interfaces: [
      'IExtendedResolver',
      '@openzeppelin/contracts/utils/introspection/IERC165.sol:IERC165',
    ],
  });
});
