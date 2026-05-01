import { CHAIN_ID } from '@/constants/chains';
import { getRpc } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import AccessListABI from '@oceanprotocol/contracts/artifacts/contracts/accesslists/AccessList.sol/AccessList.json';
import AccessListFactoryABI from '@oceanprotocol/contracts/artifacts/contracts/accesslists/AccessListFactory.sol/AccessListFactory.json';
import { AccesslistFactory } from '@oceanprotocol/lib';
import { ethers } from 'ethers';
import { useCallback } from 'react';
import { encodeFunctionData } from 'viem';

function getFactoryAddress(chainId: number): string {
  const config = Object.values(Address).find((c) => c.chainId === chainId);
  if (!config || !('AccessListFactory' in config)) {
    throw new Error(`No AccessListFactory deployed on chain ${chainId}`);
  }
  return (config as any).AccessListFactory as string;
}

function getReadContract(contractAddress: string): ethers.Contract {
  return new ethers.Contract(contractAddress, AccessListABI.abi, new ethers.JsonRpcProvider(getRpc()));
}

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
    async ({ wallets, owner }: { wallets: string[]; owner: string }): Promise<string> => {
      const factoryAddress = getFactoryAddress(CHAIN_ID);

      if (user?.type === 'eoa') {
        const signer = await getSigner();
        const factory = new AccesslistFactory(factoryAddress, signer);
        const address = await factory.deployAccessListContract(
          'BucketAccessList',
          'BAL',
          wallets.map(() => ''),
          false,
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
          'BucketAccessList',
          'BAL',
          false,
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
      const newAccessListTopic = ethers.id('NewAccessList(address,address)');
      for (const log of receipt.logs) {
        if (log.topics[0] === newAccessListTopic && log.address.toLowerCase() === factoryAddress.toLowerCase()) {
          return ethers.getAddress('0x' + log.topics[1].slice(26));
        }
      }
      throw new Error('NewAccessList event not found in receipt');
    },
    [client, getSigner, user?.type]
  );

  const getAccessListAddresses = useCallback(async (contractAddress: string): Promise<string[]> => {
    const contract = getReadContract(contractAddress);
    const totalSupply = Number(await contract.totalSupply());
    const addresses: string[] = [];
    for (let i = 0; i < totalSupply; i++) {
      const tokenId = await contract.tokenByIndex(i);
      addresses.push(await contract.ownerOf(tokenId));
    }
    return addresses;
  }, []);

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
      const contract = getReadContract(contractAddress);
      const totalSupply = Number(await contract.totalSupply());
      let tokenId: bigint | undefined;
      for (let i = 0; i < totalSupply; i++) {
        const id = await contract.tokenByIndex(i);
        const owner: string = await contract.ownerOf(id);
        if (owner.toLowerCase() === wallet.toLowerCase()) {
          tokenId = BigInt(id.toString());
          break;
        }
      }
      if (tokenId === undefined) {
        throw new Error(`Wallet ${wallet} not found in access list`);
      }
      const data = encodeFunctionData({ abi: AccessListABI.abi, functionName: 'burn', args: [tokenId] });

      if (user?.type === 'eoa') {
        const signer = await getSigner();
        const writableContract = new ethers.Contract(contractAddress, AccessListABI.abi, signer);
        await writableContract.burn(tokenId);
        return;
      }
      await sendUO(contractAddress, data);
    },
    [getSigner, sendUO, user?.type]
  );

  return {
    deployNewAccessList,
    getAccessListAddresses,
    addWalletToAccessList,
    removeWalletFromAccessList,
  };
}
