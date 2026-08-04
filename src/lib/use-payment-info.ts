import { DEFAULT_MAX_LOCK_COUNT } from '@/lib/use-pay-session';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Authorizations } from '@/types/payment';
import { roundTokenAmount } from '@/utils/formatters';
import { useCallback, useEffect, useRef, useState } from 'react';

export type PaymentInfoSnapshot = {
  authorizations: Authorizations | null;
  escrowBalance: number;
  walletBalance: number;
};

export type EscrowRequirement = {
  /** Additional funds to deposit so escrow covers this payment; rounded up. "0" when already covered. */
  depositAmount: number;
  /** Escrow authorization params to (re)grant — never shrink an existing grant. */
  maxLockedAmount: number;
  maxLockSeconds: number;
  maxLockCount: number;
  /** True when the current escrow balance + authorization already satisfy this payment. */
  sufficient: boolean;
  /** True when the wallet can't cover the required deposit. */
  insufficientWalletFunds: boolean;
};

/**
 * Escrow-sufficiency math shared by the run-job and inference payment steps. Given a payment-info
 * snapshot and the payment's cost + lock window, computes whether the current escrow balance and
 * authorization already suffice, and — if not — the deposit + (re)authorization params to request.
 * Re-authorizing OVERWRITES the previous grant, so every derived limit is `Math.max`'d against the
 * existing grant: the new one must cover both the running locks and this payment and never shrink a
 * limit already granted. A wider lock window locks no extra funds, so over-authorizing is free.
 */
export const computeEscrowRequirement = ({
  snapshot,
  totalCost,
  tokenAddress,
  requiredLockSeconds,
  minLockSecondsFloor = 0,
}: {
  snapshot: PaymentInfoSnapshot;
  totalCost: number;
  tokenAddress: string;
  requiredLockSeconds: number;
  /** Smallest lock window to ever request (run-job floors at 1s); the requirement is the max of this and the grant. */
  minLockSecondsFloor?: number;
}): EscrowRequirement => {
  const { authorizations: auth, escrowBalance, walletBalance } = snapshot;
  const currentLockedAmount = Number(auth?.currentLockedAmount ?? 0);
  const requiredMaxLocked = roundTokenAmount(totalCost + currentLockedAmount, tokenAddress, 'up');
  const depositAmount = roundTokenAmount(Math.max(0, totalCost - escrowBalance), tokenAddress, 'up');
  // Normalize the lock window once so the sufficiency check and the requested grant agree — otherwise
  // a fractional requirement (or the floor) could make an existing grant look sufficient while a
  // re-auth would still raise the cap.
  const requiredMaxLockSeconds = Math.max(minLockSecondsFloor, Math.ceil(requiredLockSeconds));

  const sufficient =
    escrowBalance >= totalCost &&
    !!auth &&
    roundTokenAmount(Number(auth.maxLockedAmount), tokenAddress) >= requiredMaxLocked &&
    Number(auth.maxLockSeconds) >= requiredMaxLockSeconds &&
    Number(auth.currentLocks) < Number(auth.maxLockCounts);

  const maxLockedAmount = Math.max(requiredMaxLocked, roundTokenAmount(Number(auth?.maxLockedAmount ?? 0), tokenAddress));
  const maxLockSeconds = Math.max(requiredMaxLockSeconds, Number(auth?.maxLockSeconds ?? 0));
  // Authorize SETS (not increments) the lock cap. Derive above the current locks so a user who has
  // used all their slots can still raise the limit and start a new session; keep any higher cap the
  // user already granted (e.g. on the escrow page) so it isn't silently shrunk on re-auth.
  const maxLockCount = Math.max(
    DEFAULT_MAX_LOCK_COUNT,
    Number(auth?.currentLocks ?? 0) + 1,
    Number(auth?.maxLockCounts ?? 0)
  );

  return {
    depositAmount,
    maxLockedAmount,
    maxLockSeconds,
    maxLockCount,
    sufficient,
    insufficientWalletFunds: walletBalance < depositAmount,
  };
};

/**
 * Loads the escrow payment state for a token/spender pair: the wallet balance, the funds already
 * deposited in escrow and the current authorizations granted to the spender. Refetches whenever
 * the pair changes; `loadPaymentInfo` re-reads on demand (e.g. after a deposit/authorize tx) and
 * resolves with the fresh snapshot so callers can act on it without waiting for a re-render.
 * Shared by the run-job and inference payment steps.
 */
export const usePaymentInfo = (tokenAddress: string, spender: string) => {
  const { account, ocean } = useOceanAccount();

  const [authorizations, setAuthorizations] = useState<Authorizations | null>(null);
  const [escrowBalance, setEscrowBalance] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Monotonic id of the most recently STARTED request. A resolved/rejected fetch only writes to
  // state if it's still the latest — otherwise a slow request for an old token/spender pair (or a
  // superseded manual reload) could clobber the current snapshot with stale data.
  const latestRequestRef = useRef(0);

  const loadPaymentInfo = useCallback(async (): Promise<PaymentInfoSnapshot | null> => {
    const requestId = ++latestRequestRef.current;
    const isLatest = () => latestRequestRef.current === requestId;
    if (!ocean || !account?.address || !tokenAddress || !spender) {
      return null;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [auth, wallet, escrow] = await Promise.all([
        ocean.getAuthorizations(tokenAddress, account.address, spender),
        ocean.getBalance(tokenAddress, account.address),
        ocean.getUserFunds(tokenAddress, account.address),
      ]);
      const snapshot: PaymentInfoSnapshot = {
        authorizations: auth,
        walletBalance: roundTokenAmount(Number(wallet), tokenAddress, 'down'),
        escrowBalance: roundTokenAmount(Number(escrow), tokenAddress, 'down'),
      };
      // Return the fresh snapshot to the direct caller regardless, but only let the latest request
      // publish it to state.
      if (isLatest()) {
        setAuthorizations(snapshot.authorizations);
        setWalletBalance(snapshot.walletBalance);
        setEscrowBalance(snapshot.escrowBalance);
      }
      return snapshot;
    } catch (err) {
      if (isLatest()) {
        setAuthorizations(null);
        setWalletBalance(null);
        setEscrowBalance(null);
        setLoadError(err instanceof Error ? err.message : 'Failed to load payment info.');
      }
      return null;
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  }, [ocean, account?.address, tokenAddress, spender]);

  // Refetch when the token/spender pair changes. Clearing here (before the fetch) drops the previous
  // pair's snapshot immediately so a stale balance/authorization is never shown against a new pair.
  useEffect(() => {
    setAuthorizations(null);
    setWalletBalance(null);
    setEscrowBalance(null);
    setLoadError(null);
    loadPaymentInfo();
  }, [loadPaymentInfo]);

  return { authorizations, escrowBalance, walletBalance, loading, loadError, loadPaymentInfo };
};
