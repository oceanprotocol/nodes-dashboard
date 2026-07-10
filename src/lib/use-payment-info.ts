import { useOceanAccount } from '@/lib/use-ocean-account';
import { Authorizations } from '@/types/payment';
import { roundTokenAmount } from '@/utils/formatters';
import { useCallback, useEffect, useState } from 'react';

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

  const loadPaymentInfo = useCallback(async (): Promise<PaymentInfoSnapshot | null> => {
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
      setAuthorizations(snapshot.authorizations);
      setWalletBalance(snapshot.walletBalance);
      setEscrowBalance(snapshot.escrowBalance);
      return snapshot;
    } catch (err) {
      setAuthorizations(null);
      setWalletBalance(null);
      setEscrowBalance(null);
      setLoadError(err instanceof Error ? err.message : 'Failed to load payment info.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [ocean, account?.address, tokenAddress, spender]);

  useEffect(() => {
    loadPaymentInfo();
  }, [loadPaymentInfo]);

  return { authorizations, escrowBalance, walletBalance, loading, loadError, loadPaymentInfo };
};
