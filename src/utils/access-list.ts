import AccessListJson from '@oceanprotocol/contracts/artifacts/contracts/accesslists/AccessList.sol/AccessList.json' with { type: 'json' }
import { ethers } from 'ethers'

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
    return true
  }
  const accessListContract = new ethers.Contract(
    accessListContractAddress,
    AccessListJson.abi,
    runner
  )
  try {
    // if has at least 1 token than is is authorized
    const balance = await accessListContract.balanceOf(addressToCheck)
    if (Number(balance) > 0) {
      return true
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}
