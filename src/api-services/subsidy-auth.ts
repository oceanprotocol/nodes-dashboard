import { getProvider } from '@/api-services/subsidy-access-list';
import { getSubsidyAuthMessage, SUBSIDY_AUTH_ERROR, SUBSIDY_AUTH_TTL_MS, SubsidyAuth } from '@/types/subsidy';
import { ethers } from 'ethers';
import type { NextApiResponse } from 'next';

const CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_SIGNATURE_LENGTH = 8192;
const ERC1271_MAGIC_VALUE = '0x1626ba7e';
const ERC1271_ABI = ['function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)'];

// Browser wallets sign the keccak256 of the message, see `signMessage` in `src/lib/sign-message.ts`.
const getBrowserWalletDigest = (message: string) => ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(message)));

const isEoaSignature = (message: string, signature: string, walletAddress: string) => {
  try {
    const recovered = ethers.verifyMessage(getBrowserWalletDigest(message), signature);
    return recovered.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
};

const isAcceptedByContract = async (account: ethers.Contract, hash: string, signature: string) => {
  try {
    return (await account.isValidSignature(hash, signature)) === ERC1271_MAGIC_VALUE;
  } catch (error) {
    // A revert or a contract without ERC-1271 means "not valid"; anything else is an RPC failure.
    if (ethers.isError(error, 'CALL_EXCEPTION') || ethers.isError(error, 'BAD_DATA')) {
      return false;
    }
    throw error;
  }
};

const isContractSignature = async (message: string, signature: string, walletAddress: string) => {
  const provider = getProvider();
  if ((await provider.getCode(walletAddress)) === '0x') {
    return false;
  }
  const account = new ethers.Contract(walletAddress, ERC1271_ABI, provider);
  // The embedded smart account signs the raw message; a contract wallet connected as a browser
  // wallet signs the pre-hashed one.
  return (
    (await isAcceptedByContract(account, ethers.hashMessage(message), signature)) ||
    (await isAcceptedByContract(account, ethers.hashMessage(getBrowserWalletDigest(message)), signature))
  );
};

const isValidSubsidyAuth = async (walletAddress: string, { expiryTimestamp, signature }: SubsidyAuth) => {
  const now = Date.now();
  if (
    !Number.isSafeInteger(expiryTimestamp) ||
    expiryTimestamp <= now ||
    expiryTimestamp > now + SUBSIDY_AUTH_TTL_MS + CLOCK_SKEW_MS
  ) {
    return false;
  }
  if (!ethers.isHexString(signature) || signature.length > MAX_SIGNATURE_LENGTH) {
    return false;
  }
  const message = getSubsidyAuthMessage(walletAddress, expiryTimestamp);
  return (
    isEoaSignature(message, signature, walletAddress) || (await isContractSignature(message, signature, walletAddress))
  );
};

/** Responds 401 and returns `false` unless the wallet signed the subsidy auth message. */
export const requireWalletSignature = async (response: NextApiResponse, walletAddress: string, auth: SubsidyAuth) => {
  try {
    if (await isValidSubsidyAuth(walletAddress, auth)) {
      return true;
    }
  } catch (error) {
    console.error('Error verifying subsidy signature:', error);
    response.status(503).json({ message: "We couldn't verify your wallet signature. Please try again." });
    return false;
  }
  // `serverTime` lets a client with a wrong clock sign again with a valid expiry.
  response.status(401).json({
    error: SUBSIDY_AUTH_ERROR,
    message: 'Wallet signature is invalid or expired. Please try again.',
    serverTime: Date.now(),
  });
  return false;
};
