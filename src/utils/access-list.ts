import { ChainAddressPair } from '@/types/node-storage';
import AccessListJson from '@oceanprotocol/contracts/artifacts/contracts/accesslists/AccessList.sol/AccessList.json' with { type: 'json' };
import { PersistentStorageAccessList } from '@oceanprotocol/lib';
import { ethers } from 'ethers';

/**
 * @param accessListContractAddress the access list contract address
 * @param addressToCheck the account address to check on the access list
 * @param runner provider or signer for the contract call
 * @returns true if the account has balanceOf > 0 OR if the accessList is empty, false otherwise
 */
export async function checkAddressOnAccessList(
  accessListContractAddress: string,
  addressToCheck: string,
  runner: ethers.ContractRunner
): Promise<boolean> {
  if (!accessListContractAddress) {
    return true;
  }
  const accessListContract = new ethers.Contract(accessListContractAddress, AccessListJson.abi, runner);
  try {
    // if has at least 1 token than is is authorized
    const balance = await accessListContract.balanceOf(addressToCheck);
    if (Number(balance) > 0) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Converts a list of chain-address pairs into ocean.js access lists format
 * @param rows array of chain-address pairs
 * @returns access lists in the format expected by ocean.js
 */
export function rowsToAccessLists(rows: ChainAddressPair[]): PersistentStorageAccessList[] {
  const map: Record<string, string[]> = {};
  for (const { chainId, address } of rows) {
    if (!map[chainId]) {
      map[chainId] = [];
    }
    map[chainId].push(address);
  }
  return Object.entries(map).map(([chainId, addresses]) => ({ [chainId]: addresses }));
}
