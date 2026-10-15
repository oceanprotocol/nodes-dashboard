import { getRpc } from '@/lib/constants';
import { checkAddressOnAccessList } from '@/utils/access-list';
import AccessListABI from '@oceanprotocol/contracts/artifacts/contracts/accesslists/AccessList.sol/AccessList.json';
import { ethers } from 'ethers';

let _provider: ethers.JsonRpcProvider | null = null;
let _signer: ethers.NonceManager | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(getRpc());
  }
  return _provider;
}

function getSigner(): ethers.NonceManager {
  if (!_signer) {
    const privateKey = process.env.SUBSIDY_ACCESS_LIST_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('Subsidy access list signer not configured');
    }
    _signer = new ethers.NonceManager(new ethers.Wallet(privateKey, getProvider()));
  }
  return _signer;
}

function getAccessListAddress(): string {
  const address = process.env.SUBSIDY_ACCESS_LIST_ADDRESS;
  if (!address || !ethers.isAddress(address)) {
    throw new Error('Subsidy access list not configured');
  }
  return address;
}

export async function isOnSubsidyAccessList(walletAddress: string): Promise<boolean> {
  return checkAddressOnAccessList(getAccessListAddress(), walletAddress, getProvider());
}

export async function addToSubsidyAccessList(walletAddress: string): Promise<string> {
  const signer = getSigner();
  const contract = new ethers.Contract(getAccessListAddress(), AccessListABI.abi, signer);
  let tx: ethers.ContractTransactionResponse;
  try {
    tx = await contract.mint(walletAddress, '');
  } catch (error) {
    // The nonce was reserved before sending, so resync it with the chain.
    signer.reset();
    throw error;
  }
  const receipt = await tx.wait();
  if (receipt?.status !== 1) {
    throw new Error(`Access list mint failed: ${tx.hash}`);
  }
  return tx.hash;
}
