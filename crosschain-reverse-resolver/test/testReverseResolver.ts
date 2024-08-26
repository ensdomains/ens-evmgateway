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
  labelhash,
  namehash,
  testActions,
  walletActions,
  zeroHash,
  type Address,
} from 'viem';
import { anvil } from 'viem/chains';

import { dnsEncodeName, getReverseNode } from './utils.js';

const NAMESPACE = 2147483658n; // OP
const getNamespacedReverseNode = (address: Address) =>
  getReverseNode(address, { ns: NAMESPACE.toString() });

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

  // basic ens deploy
  const ensRegistry = await hre.viem.deployContract('ENSRegistry', []);

  await ensRegistry.write.setSubnodeOwner([
    zeroHash,
    labelhash('reverse'),
    accounts[0].address,
  ]);

  const l1Verifier = await hre.viem.deployContract('L1Verifier', [
    [`http://0.0.0.0:${process.env.SERVER_PORT}/{sender}/{data}.json`],
  ]);
  const defaultReverseResolver = await hre.viem.deployContract(
    'DefaultReverseResolver',
    []
  );
  const l2ReverseResolver = await hre.viem.deployContract('L2ReverseResolver', [
    namehash(`${NAMESPACE}.reverse`),
    NAMESPACE,
  ]);
  const l1ReverseResolver = await hre.viem.deployContract('L1ReverseResolver', [
    ensRegistry.address,
    l1Verifier.address,
    l2ReverseResolver.address,
  ]);

  await ensRegistry.write.setSubnodeRecord([
    namehash('reverse'),
    labelhash(`${NAMESPACE}`),
    accounts[0].address,
    l1ReverseResolver.address,
    0n,
  ]);
  await ensRegistry.write.setSubnodeRecord([
    namehash('reverse'),
    labelhash('default'),
    accounts[0].address,
    defaultReverseResolver.address,
    0n,
  ]);

  await l2ReverseResolver.write.setName(['null'], { account: accounts[9] });
  await client.mine({ blocks: 1 });

  return {
    client,
    accounts,
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
    defaultReverseResolver: getContract({
      abi: defaultReverseResolver.abi,
      address: defaultReverseResolver.address,
      client,
    }),
    l2ReverseResolver: getContract({
      abi: l2ReverseResolver.abi,
      address: l2ReverseResolver.address,
      client,
    }),
    l1ReverseResolver: getContract({
      abi: l1ReverseResolver.abi,
      address: l1ReverseResolver.address,
      client,
    }),
  };
}

describe('ReverseResolver', () => {
  it('should resolve name that is set on l2', async () => {
    const { client, accounts, l1ReverseResolver, l2ReverseResolver } =
      await loadFixture(fixture);
    const name = 'vitalik.eth';

    await l2ReverseResolver.write.setName([name]);
    await client.mine({ blocks: 1 });

    const reverseNode = getNamespacedReverseNode(accounts[0].address);
    const encodedL2ReverseName = dnsEncodeName(reverseNode);
    const nameCalldata = encodeFunctionData({
      abi: l2ReverseResolver.abi,
      functionName: 'name',
      args: [namehash(reverseNode)],
    });

    const result = await l1ReverseResolver.read.resolve([
      encodedL2ReverseName,
      nameCalldata,
    ]);
    const decodedResult = decodeFunctionResult({
      abi: l2ReverseResolver.abi,
      functionName: 'name',
      data: result,
    });

    expect(decodedResult).toBe(name);
  });

  it('should resolve default if no name is set on l2', async () => {
    const { client, accounts, l1ReverseResolver, defaultReverseResolver } =
      await loadFixture(fixture);
    const name = 'vitalik.eth';

    await defaultReverseResolver.write.setName([name]);
    await client.mine({ blocks: 1 });

    const reverseNode = getNamespacedReverseNode(accounts[0].address);
    const encodedL2ReverseName = dnsEncodeName(reverseNode);
    const nameCalldata = encodeFunctionData({
      abi: defaultReverseResolver.abi,
      functionName: 'name',
      args: [namehash(reverseNode)],
    });

    const result = await l1ReverseResolver.read.resolve([
      encodedL2ReverseName,
      nameCalldata,
    ]);
    const decodedResult = decodeFunctionResult({
      abi: defaultReverseResolver.abi,
      functionName: 'name',
      data: result,
    });

    expect(decodedResult).toBe(name);
  });

  it('should resolve to null if no l2 or default name', async () => {
    const { accounts, l1ReverseResolver, l2ReverseResolver } =
      await loadFixture(fixture);

    const reverseNode = getNamespacedReverseNode(accounts[0].address);
    const encodedL2ReverseName = dnsEncodeName(reverseNode);
    const nameCalldata = encodeFunctionData({
      abi: l2ReverseResolver.abi,
      functionName: 'name',
      args: [namehash(reverseNode)],
    });

    const result = await l1ReverseResolver.read.resolve([
      encodedL2ReverseName,
      nameCalldata,
    ]);
    const decodedResult = decodeFunctionResult({
      abi: l2ReverseResolver.abi,
      functionName: 'name',
      data: result,
    });

    expect(decodedResult).toBe('');
  });

  shouldSupportInterfaces({
    contract: () => loadFixture(fixture).then((f) => f.l1ReverseResolver),
    interfaces: ['IExtendedResolver', 'IERC165'],
  });
});
