import { useOceanAccount } from '@/lib/use-ocean-account';
import { getSupportedTokens } from '@/constants/tokens';
import { Authorizations, EscrowLock } from '@/types/payment';
import { useCallback, useEffect, useState } from 'react';
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

export const useEscrowData = (): UseEscrowDataReturn => {
  const { account, ocean } = useOceanAccount();

  const [tokens, setTokens] = useState<EscrowTokenInfo[]>([]);
  const [spenders, setSpenders] = useState<EscrowSpenderInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ocean || !account?.address) {
      setTokens([]);
      setSpenders([]);
      return;
    }
    setLoading(true);
    try {
      const supportedTokens = getSupportedTokens();
      const tokenList = Object.entries(supportedTokens).map(([symbol, token]) => ({ symbol, ...token }));

      const tokenInfos = await Promise.all(
        tokenList.map(async (token) => {
          const funds = await ocean.getUserFundsDetailed(token.address, account.address!);
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
      setTokens(tokenInfos);

      // List spenders (payees) straight from the Escrow contract: `getAllAuthorizations` queries
      // with a wildcard payee, returning every authorization the payer granted for a token. No node
      // event indexing needed, so this works on any chain (including sepolia).
      const settled = await Promise.allSettled(
        tokenList.map(async (token) => {
          const allAuthorizations = await ocean.getAllAuthorizations(token.address, account.address!);
          return Promise.all(
            allAuthorizations.map(async (authorizations) => {
              const spender = authorizations.payee;
              const locks = await ocean.getLocks(token.address, account.address!, spender);
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
      const failCount = settled.filter((r) => r.status === 'rejected').length;
      if (failCount > 0) {
        toast.warning(`Failed to load authorization data for ${failCount} token${failCount > 1 ? 's' : ''}`);
      }
      const spenderInfos = settled
        .filter((r): r is PromiseFulfilledResult<EscrowSpenderInfo[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value)
        // Drop revoked authorizations — limits all zeroed, no longer usable.
        .filter((info) => !isRevokedAuthorization(info.authorizations));
      setSpenders(spenderInfos);
    } catch (err) {
      console.error('Failed to load escrow data:', err);
    } finally {
      setLoading(false);
    }
  }, [ocean, account?.address]);

  useEffect(() => {
    load();
  }, [load]);

  return { tokens, spenders, loading, reload: load };
};
