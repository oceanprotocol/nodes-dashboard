import { OceanProvider } from '@/lib/ocean-provider';
import { EscrowLock } from '@/types/payment';
import { formatTokenAmount } from '@/utils/formatters';
import { sha256, toUtf8Bytes } from 'ethers';

/**
 * The escrow jobId ocean-node locks a service's payments under: `create256Hash(serviceId)`, i.e. the
 * sha256 of the service id string. The node reuses this ONE id for the start lock and for every
 * extension lock (extendService passes `task.serviceId` to escrow.createLock), and the Escrow contract
 * rejects a createLock whose (payer, jobId) already has a lock with "JobId already exists". So a
 * previous extension whose lock was never claimed or cancelled blocks every later extension of the
 * same service until that lock is released on-chain.
 */
export const serviceEscrowJobId = (serviceId: string): string => BigInt(sha256(toUtf8Bytes(serviceId))).toString();

export const isEscrowJobIdConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /jobid already exists/i.test(message);
};

/**
 * The lock the node still holds under this service's jobId, if any. Read straight from the Escrow
 * contract (a view call: no gas, no signature), so a service that can't be extended is known before
 * the user starts a prolong.
 */
export const findServiceEscrowLock = async ({
  ocean,
  payee,
  payer,
  serviceId,
  tokenAddress,
}: {
  ocean: OceanProvider;
  payee: string;
  payer: string;
  serviceId: string;
  tokenAddress: string;
}): Promise<EscrowLock | null> => {
  const jobId = serviceEscrowJobId(serviceId);
  const locks = await ocean.getLocks(tokenAddress, payer, payee);
  return locks.find((lock) => lock.jobId === jobId) ?? null;
};

/** Why Prolong is unavailable while the node holds `lock`; `lock` null when only the revert is known. */
export const serviceEscrowLockMessage = ({
  lock,
  tokenAddress,
  tokenSymbol,
}: {
  lock: EscrowLock | null;
  tokenAddress: string;
  tokenSymbol?: string;
}): string => {
  if (!lock) {
    return 'Prolong is unavailable: the node is still holding an earlier top-up for this service. Your payment stays in your escrow balance.';
  }
  const amount = `${formatTokenAmount(lock.amount, tokenAddress)} ${tokenSymbol ?? ''}`.trim();
  const base = `Prolong is unavailable: the node is still holding an earlier top-up of ${amount} for this service.`;
  const until = new Date(lock.expiry * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  if (lock.expiry * 1000 > Date.now()) {
    return `${base} It can be released after ${until}.`;
  }
  return `${base} Its hold ended ${until}, but the node hasn't released it yet.`;
};
