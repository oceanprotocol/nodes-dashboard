import { useOceanAccount } from '@/lib/use-ocean-account';
import { Authorizations } from '@/types/payment';
import { roundTokenAmount } from '@/utils/formatters';
import { useCallback, useEffect, useRef, useState } from 'react';

export type PaymentInfoSnapshot = {
  authorizations: Authorizations | null;
  escrowBalance: number;
  walletBalance: number;
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
