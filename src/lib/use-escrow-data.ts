import { useOceanAccount } from '@/lib/use-ocean-account';
import { getSupportedTokens } from '@/constants/tokens';
import { Authorizations, EscrowLock } from '@/types/payment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

export type EscrowTokenInfo = {
  symbol: string;
  address: string;
  available: number;
  locked: number;
  walletBalance: number;
};

// A revoked authorization is one re-authorized with all limits set to zero.
const isRevokedAuthorization = (auth: Authorizations): boolean =>
  Number(auth.maxLockedAmount) === 0 && Number(auth.maxLockSeconds) === 0 && Number(auth.maxLockCounts) === 0;

export type EscrowSpenderInfo = {
  tokenSymbol: string;
  tokenAddress: string;
  spender: string;
  authorizations: Authorizations;
  locks: EscrowLock[];
};

export type UseEscrowDataReturn = {
  tokens: EscrowTokenInfo[];
  spenders: EscrowSpenderInfo[];
  loading: boolean;
  reload: () => void;
};

// `escrowAddress` points the reads at a different escrow deployment than the one in address.json
// (the legacy contract). Omit it for the current deployment.
export const useEscrowData = (escrowAddress?: string): UseEscrowDataReturn => {
  const { account, ocean } = useOceanAccount();

  const [tokens, setTokens] = useState<EscrowTokenInfo[]>([]);
  const [spenders, setSpenders] = useState<EscrowSpenderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  // Switching contracts can leave a previous load in flight; only the latest load may set state,
  // so data from one contract never lands while another is selected.
  const loadIdRef = useRef(0);
  // load() reads the selected contract from a ref rather than closing over it, so a reload captured
  // before a contract switch (e.g. by an in-flight transaction's onSuccess) refreshes the contract
  // selected now instead of resurrecting the old one's data.
  const escrowAddressRef = useRef(escrowAddress);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    const isCurrent = () => loadIdRef.current === loadId;
    const contractAddress = escrowAddressRef.current;
    if (!ocean || !account?.address) {
      setTokens([]);
      setSpenders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supportedTokens = getSupportedTokens();
      const tokenList = Object.entries(supportedTokens).map(([symbol, token]) => ({ symbol, ...token }));

      const tokenInfos = await Promise.all(
        tokenList.map(async (token) => {
          const funds = await ocean.getUserFundsDetailed(token.address, account.address!, contractAddress);
          const walletBalance = Number(await ocean.getBalance(token.address, account.address!));
          return {
            symbol: token.symbol,
            address: token.address,
            available: funds.available,
            locked: funds.locked,
            walletBalance,
          };
        })
      );
      if (!isCurrent()) return;
      setTokens(tokenInfos);

      // List spenders (payees) straight from the Escrow contract: `getAllAuthorizations` queries
      // with a wildcard payee, returning every authorization the payer granted for a token. No node
      // event indexing needed, so this works on any chain (including sepolia).
      const settled = await Promise.allSettled(
        tokenList.map(async (token) => {
          const allAuthorizations = await ocean.getAllAuthorizations(token.address, account.address!, contractAddress);
          return Promise.all(
            allAuthorizations.map(async (authorizations) => {
              const spender = authorizations.payee;
              // Contract getLocks filters payer/token with OR, so it leaks other payers' locks and
              // other tokens. Narrow to this user's locks for this token client-side.
              const allLocks = await ocean.getLocks(token.address, account.address!, spender, contractAddress);
              const locks = allLocks.filter(
                (lock) =>
                  lock.payer.toLowerCase() === account.address!.toLowerCase() &&
                  lock.token.toLowerCase() === token.address.toLowerCase()
              );
              return {
                tokenSymbol: token.symbol,
                tokenAddress: token.address,
                spender,
                authorizations,
                locks,
              };
            })
          );
        })
      );
      if (!isCurrent()) return;
      const failCount = settled.filter((r) => r.status === 'rejected').length;
      if (failCount > 0) {
        toast.warning(`Failed to load authorization data for ${failCount} token${failCount > 1 ? 's' : ''}`);
      }
      const spenderInfos = settled
        .filter((r): r is PromiseFulfilledResult<EscrowSpenderInfo[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value)
        // Drop revoked authorizations — limits all zeroed, no longer usable.
        .filter((info) => !isRevokedAuthorization(info.authorizations) || info.locks.length > 0);
      setSpenders(spenderInfos);
    } catch (err) {
      console.error('Failed to load escrow data:', err);
    } finally {
      if (isCurrent()) {
        setLoading(false);
      }
    }
  }, [ocean, account?.address]);

  // On contract switch (and initial mount): clear the previous contract's data so a loader shows
  // instead of the other contract's balances, then fetch from the newly selected contract.
  useEffect(() => {
    escrowAddressRef.current = escrowAddress;
    setTokens([]);
    setSpenders([]);
    load();
  }, [escrowAddress, load]);

  return { tokens, spenders, loading, reload: load };
};
