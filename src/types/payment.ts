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
