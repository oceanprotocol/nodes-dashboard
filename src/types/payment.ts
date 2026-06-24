export type Authorizations = {
  payee: string;
  maxLockedAmount: string;
  currentLockedAmount: string;
  maxLockSeconds: string;
  maxLockCounts: string;
  currentLocks: string;
};

export type EscrowLock = {
  jobId: string;
  payer: string;
  amount: number;
  expiry: number;
  token: string;
};

// Escrow event record as indexed and returned by an Ocean node's
// GET /api/services/escrow/events endpoint. Every node indexes all on-chain escrow events,
// including those involving other nodes. Note: `Auth` events carry no `token`.
export type EscrowEvent = {
  id: string;
  eventType: string;
  chainId: number;
  contract: string;
  block: number;
  txHash: string;
  payer?: string;
  payee?: string;
  token?: string;
  jobId?: string;
  amount?: string;
  expiry?: string;
  proof?: string;
  maxLockedAmount?: string;
  maxLockSeconds?: string;
  maxLockCounts?: string;
};
