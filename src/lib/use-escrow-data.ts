import { CHAIN_ID } from '@/constants/chains';
import { NODE_URL } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { getEscrowEvents } from '@/services/nodeService';
import { getSupportedTokens } from '@/constants/tokens';
import { Authorizations, EscrowLock } from '@/types/payment';
import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

export type EscrowTokenInfo = {
  symbol: string;
  address: string;
  available: number;
  locked: number;
  walletBalance: number;
};

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

// The dashboard's compute gateway. Locks/authorizations are per-payee (spender); the spenders the
// dashboard knows about are the consumer addresses of the gateway's compute environments.
const dedupeAddresses = (addresses: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const address of addresses) {
    const key = address.toLowerCase();
    if (!ethers.isAddress(address) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(address);
  }
  return result;
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

      // Discover spenders (payees) from the node's indexed `Auth` events. Nodes index every
      // on-chain escrow event, so this returns all payees the user has authorized without
      // iterating compute envs. `getAuthorizations` below is the live-truth gate.
      // Note: the node only indexes base — sepolia returns nothing.
      let candidateSpenders: string[] = [];
      try {
        const authEvents = await getEscrowEvents({
          chainId: CHAIN_ID,
          eventType: 'Auth',
          payer: account.address,
        });
        candidateSpenders = authEvents
          .map((event) => event.payee)
          .filter((payee): payee is string => Boolean(payee));
      } catch (err) {
        console.warn('Escrow event query failed for spender discovery:', err);
      }

      const spenderAddresses = dedupeAddresses(candidateSpenders);

      const settled = await Promise.allSettled(
        tokenList.flatMap((token) =>
          spenderAddresses.map(async (spender) => {
            const authorizations = await ocean.getAuthorizations(token.address, account.address!, spender);
            if (!authorizations) {
              return null;
            }
            const locks = await ocean.getLocks(token.address, account.address!, spender);
            return {
              tokenSymbol: token.symbol,
              tokenAddress: token.address,
              spender,
              authorizations,
              locks,
            };
          })
        )
      );
      const failCount = settled.filter((r) => r.status === 'rejected').length;
      if (failCount > 0) {
        toast.warning(`Failed to load authorization data for ${failCount} consumer${failCount > 1 ? 's' : ''}`);
      }
      const spenderInfos = settled
        .filter((r): r is PromiseFulfilledResult<EscrowSpenderInfo | null> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((info): info is EscrowSpenderInfo => info !== null);
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
