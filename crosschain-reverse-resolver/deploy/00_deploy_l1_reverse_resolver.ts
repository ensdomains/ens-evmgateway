import type { DeployFunction } from 'hardhat-deploy/types.js';
import { keccak256 } from 'viem';
import {
  arbitrumSepolia,
  baseSepolia,
  lineaSepolia,
  mainnet,
  optimismSepolia,
  scrollSepolia,
  sepolia,
} from 'viem/chains';
import { dnsEncodeName, getReverseNamespace } from '../test/utils.js';

const owners = {
  [sepolia.id]: '0x343431e9CEb7C19cC8d3eA0EE231bfF82B584910',
  // dao address
  [mainnet.id]: '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7',
} as const;

const getDnsEncodedReverseNameHash = (chainId: number) => {
  const namespace = getReverseNamespace({
    chainId,
  });
  return keccak256(dnsEncodeName(namespace));
};

const targets = {
  [sepolia.id]: {
    Base: {
      dnsEncodedReverseNameHash: getDnsEncodedReverseNameHash(baseSepolia.id),
      verifier: '0x8e77b311bed6906799BD3CaFBa34c13b64CAF460',
      target: '0xa12159e5131b1eEf6B4857EEE3e1954744b5033A',
      urls: ['https://lb.drpc.org/gateway/unruggable?network=base-sepolia'],
    },
    Optimism: {
      dnsEncodedReverseNameHash: getDnsEncodedReverseNameHash(
        optimismSepolia.id
      ),
      verifier: '0x5F1681D608e50458D96F43EbAb1137bA1d2A2E4D',
      target: '0x74E20Bd2A1fE0cdbe45b9A1d89cb7e0a45b36376',
      urls: ['https://lb.drpc.org/gateway/unruggable?network=optimism-sepolia'],
    },
    Arbitrum: {
      dnsEncodedReverseNameHash: getDnsEncodedReverseNameHash(
        arbitrumSepolia.id
      ),
      verifier: '0x9133D1A6409b25546147229E102DFa439048028F',
      target: '0x74E20Bd2A1fE0cdbe45b9A1d89cb7e0a45b36376',
      urls: ['https://lb.drpc.org/gateway/unruggable?network=arbitrum-sepolia'],
    },
    Scroll: {
      dnsEncodedReverseNameHash: getDnsEncodedReverseNameHash(scrollSepolia.id),
      verifier: '0xd6eaADB25D5145c3b0407341292720Efd798a51f',
      target: '0xc0497E381f536Be9ce14B0dD3817cBcAe57d2F62',
      urls: ['https://lb.drpc.org/gateway/unruggable?network=scroll-sepolia'],
    },
    Linea: {
      dnsEncodedReverseNameHash: getDnsEncodedReverseNameHash(lineaSepolia.id),
      verifier: '0x6AD2BbEE28e780717dF146F59c2213E0EB9CA573',
      target: '0x74E20Bd2A1fE0cdbe45b9A1d89cb7e0a45b36376',
      urls: ['https://lb.drpc.org/gateway/unruggable?network=linea-sepolia'],
    },
  },
} as const;

const func: DeployFunction = async function (hre) {
  const { viem } = hre;
  const { deployer } = await viem.getNamedClients();

  const publicClient = await viem.getPublicClient();

  const ensRegistryAddress = publicClient.chain.contracts!.ensRegistry!.address;

  const targetsForChain =
    targets[publicClient.chain.id as keyof typeof targets];
  const owner = owners[publicClient.chain.id as keyof typeof owners];

  for (const [
    chainName,
    { verifier, target, urls, dnsEncodedReverseNameHash },
  ] of Object.entries(targetsForChain)) {
    await viem.deploy(
      'L1ReverseResolver',
      [
        owner,
        ensRegistryAddress,
        verifier,
        target,
        dnsEncodedReverseNameHash,
        urls,
      ],
      {
        alias: `${chainName}L1ReverseResolver`,
        client: deployer,
      }
    );
  }
};

func.tags = ['L1ReverseResolver'];

export default func;
