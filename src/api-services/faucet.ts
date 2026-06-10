import { getRpc } from '@/lib/constants';
import FaucetArtifact from '@oceanprotocol/contracts/artifacts/contracts/grants/GrantsTokenFaucet.sol/GrantsTokenFaucet.json';
import { ethers } from 'ethers';

let _provider: ethers.JsonRpcProvider | null = null;
let _faucet: ethers.Contract | null = null;

export function getRpcProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(getRpc());
  }
  return _provider;
}

function getFaucetContract(): ethers.Contract {
  const faucetAddress = process.env.GRANT_FAUCET_ADDRESS;
  if (!faucetAddress) {
    throw new Error('Faucet not configured');
  }
  if (!_faucet) {
    _faucet = new ethers.Contract(faucetAddress, FaucetArtifact.abi, getRpcProvider());
  }
  return _faucet;
}

/**
 * Reads the faucet's per-user nonce. Returns the value the contract last
 * recorded for `walletAddress` — non-zero when a claim has succeeded.
 */
export async function getOnChainUserNonce(walletAddress: string): Promise<bigint> {
  return (await getFaucetContract().userNonces(walletAddress)) as bigint;
}

/**
 * True iff the faucet has already accepted a claim for `walletAddress`
 * carrying `issuedNonce`. Used to reconcile grant rows whose `/confirm`
 * call never landed (closed browser, network blip, RPC lag).
 */
export async function isGrantRedeemedOnChain(walletAddress: string, issuedNonce: number): Promise<boolean> {
  const onChainNonce = await getOnChainUserNonce(walletAddress);
  // Contract stores the last-used nonce and requires strictly greater on next
  // claim. Any on-chain nonce >= issued nonce means this slot was consumed.
  return onChainNonce >= BigInt(issuedNonce);
}
