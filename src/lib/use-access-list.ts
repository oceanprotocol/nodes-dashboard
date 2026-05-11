import { CHAIN_ID } from '@/constants/chains';
import { NODE_URL, getRpc } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import AccessListABI from '@oceanprotocol/contracts/artifacts/contracts/accesslists/AccessList.sol/AccessList.json';
import AccessListFactoryABI from '@oceanprotocol/contracts/artifacts/contracts/accesslists/AccessListFactory.sol/AccessListFactory.json';
import { AccesslistFactory } from '@oceanprotocol/lib';
import { ethers } from 'ethers';
import { useCallback } from 'react';
import { encodeFunctionData } from 'viem';

export type AccessListDoc = {
  chainId: number;
  contractAddress: string;
  factoryDeployed: boolean;
  transferable: boolean;
  users: { wallet: string; tokenId: number; block: number; txId: string }[];
  lastUpdatedBlock: number;
  lastTxId: string;
};

export type AccessListSummary = {
  chainId: number;
  contractAddress: string;
  isOwner: boolean;
};

function getChainConfig(chainId: number) {
  const config = Object.values(Address).find((c) => c.chainId === chainId);
  if (!config || !('AccessListFactory' in config)) {
    throw new Error(`No AccessListFactory deployed on chain ${chainId}`);
  }
  return config as { chainId: number; AccessListFactory: string; startBlock?: number };
}

function getFactoryAddress(chainId: number): string {
  return getChainConfig(chainId).AccessListFactory;
}

function getReadContract(contractAddress: string): ethers.Contract {
  return new ethers.Contract(contractAddress, AccessListABI.abi, new ethers.JsonRpcProvider(getRpc()));
}

const NEW_ACCESS_LIST_TOPIC = ethers.id('NewAccessList(address,address)');

export function useAccessList() {
  const { client, provider, user } = useOceanAccount();

  const getSigner = useCallback(async () => {
    if (!provider) {
      throw new Error('No provider available');
    }
    return provider.getSigner();
  }, [provider]);

  const sendUO = useCallback(
    async (target: string, data: `0x${string}`) => {
      if (!client) {
        throw new Error('Wallet not connected');
      }
      const { hash } = await client.sendUserOperation({
        uo: { target: target as `0x${string}`, data },
      });
      await client.waitForUserOperationTransaction({ hash });
    },
    [client]
  );

  const deployNewAccessList = useCallback(
    async ({
      name,
      symbol,
      transferable = false,
      owner,
      wallets,
    }: {
      name: string;
      symbol: string;
      transferable?: boolean;
      owner: string;
      wallets: string[];
    }): Promise<string> => {
      const factoryAddress = getFactoryAddress(CHAIN_ID);

      if (user?.type === 'eoa') {
        const signer = await getSigner();
        const factory = new AccesslistFactory(factoryAddress, signer);
        const address = await factory.deployAccessListContract(
          name,
          symbol,
          wallets.map(() => ''),
          transferable,
          owner,
          wallets
        );
        if (!address) {
          throw new Error('Failed to deploy access list contract');
        }
        return address;
      }

      if (!client) {
        throw new Error('Wallet not connected');
      }
      const data = encodeFunctionData({
        abi: AccessListFactoryABI.abi,
        functionName: 'deployAccessListContract',
        args: [
          name,
          symbol,
          transferable,
          owner as `0x${string}`,
          wallets as `0x${string}`[],
          wallets.map(() => ''),
        ],
      });
      const { hash } = await client.sendUserOperation({
        uo: { target: factoryAddress as `0x${string}`, data },
      });
      const txHash = await client.waitForUserOperationTransaction({ hash });
      const rpcProvider = new ethers.JsonRpcProvider(getRpc());
      const receipt = await rpcProvider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Could not fetch transaction receipt');
      }
      for (const log of receipt.logs) {
        if (log.topics[0] === NEW_ACCESS_LIST_TOPIC && log.address.toLowerCase() === factoryAddress.toLowerCase()) {
          return ethers.getAddress('0x' + log.topics[1].slice(26));
        }
      }
      throw new Error('NewAccessList event not found in receipt');
    },
    [client, getSigner, user?.type]
  );

  /**
   * Read the on-chain owner of an access list contract.
   */
  const getAccessListOwner = useCallback(async (contractAddress: string): Promise<string> => {
    const contract = getReadContract(contractAddress);
    return await contract.owner();
  }, []);

  /**
   * Read the on-chain name of an access list contract.
   */
  const getAccessListName = useCallback(async (contractAddress: string): Promise<string> => {
    const contract = getReadContract(contractAddress);
    return await contract.name();
  }, []);

  /**
   * Fetch a single access list document from the ocean-node indexer.
   * Returns null when the list is not yet indexed (404).
   */
  const fetchAccessListFromIndexer = useCallback(
    async (contractAddress: string, chainId: number = CHAIN_ID): Promise<AccessListDoc | null> => {
      const url = `${NODE_URL}/api/services/accesslists/${chainId}/${contractAddress.toLowerCase()}`;
      const res = await fetch(url);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch access list (${res.status})`);
      }
      return (await res.json()) as AccessListDoc;
    },
    []
  );

  /**
   * Get wallet members of an access list via the ocean-node indexer.
   * Falls back to an empty list when the contract is not yet indexed.
   */
  const getAccessListAddresses = useCallback(
    async (contractAddress: string): Promise<string[]> => {
      const doc = await fetchAccessListFromIndexer(contractAddress);
      if (!doc) return [];
      return doc.users.map((u) => ethers.getAddress(u.wallet));
    },
    [fetchAccessListFromIndexer]
  );

  /**
   * Search the indexer for access lists where `wallet` is a member.
   */
  const searchAccessListsByMember = useCallback(
    async (wallet: string, chainId: number = CHAIN_ID): Promise<AccessListDoc[]> => {
      const url = `${NODE_URL}/api/services/accesslists?wallet=${wallet}&chainId=${chainId}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to search access lists (${res.status})`);
      }
      return (await res.json()) as AccessListDoc[];
    },
    []
  );

  const addWalletToAccessList = useCallback(
    async ({ contractAddress, wallet }: { contractAddress: string; wallet: string }): Promise<void> => {
      if (user?.type === 'eoa') {
        const signer = await getSigner();
        const contract = new ethers.Contract(contractAddress, AccessListABI.abi, signer);
        await contract.mint(wallet, '');
        return;
      }
      const data = encodeFunctionData({
        abi: AccessListABI.abi,
        functionName: 'mint',
        args: [wallet as `0x${string}`, ''],
      });
      await sendUO(contractAddress, data);
    },
    [getSigner, sendUO, user?.type]
  );

  const removeWalletFromAccessList = useCallback(
    async ({ contractAddress, wallet }: { contractAddress: string; wallet: string }): Promise<void> => {
      const doc = await fetchAccessListFromIndexer(contractAddress);
      const entry = doc?.users.find((u) => u.wallet.toLowerCase() === wallet.toLowerCase());
      if (!entry) {
        throw new Error(`Wallet ${wallet} not found in access list`);
      }
      const tokenId = BigInt(entry.tokenId);
      const data = encodeFunctionData({ abi: AccessListABI.abi, functionName: 'burn', args: [tokenId] });

      if (user?.type === 'eoa') {
        const signer = await getSigner();
        const writableContract = new ethers.Contract(contractAddress, AccessListABI.abi, signer);
        await writableContract.burn(tokenId);
        return;
      }
      await sendUO(contractAddress, data);
    },
    [fetchAccessListFromIndexer, getSigner, sendUO, user?.type]
  );

  return {
    deployNewAccessList,
    getAccessListAddresses,
    getAccessListName,
    getAccessListOwner,
    fetchAccessListFromIndexer,
    searchAccessListsByMember,
    addWalletToAccessList,
    removeWalletFromAccessList,
  };
}
