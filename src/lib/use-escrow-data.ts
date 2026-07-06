import { useOceanAccount } from '@/lib/use-ocean-account';
import { getApiRoute } from '@/config';
import { getSupportedTokens } from '@/constants/tokens';
import { Authorizations, EscrowLock } from '@/types/payment';
import { Node } from '@/types/nodes';
import axios from 'axios';
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
  // Resolved from the nodes API by matching the spender wallet to a node's `address`.
  // Undefined while loading or if the wallet maps to no known node.
  nodeId?: string;
  nodeFriendlyName?: string;
};

// Resolve node ids for a list of payment wallets in a single request. The nodes endpoint
// matches `address` against any value in a comma-separated list (backend splits it into an
// OR of case-insensitive matches). Returns a map keyed by lowercased wallet address;
// wallets with no matching node are simply absent.
const fetchNodesByWallets = async (
  wallets: string[]
): Promise<Map<string, { id: string; friendlyName?: string }>> => {
  const byWallet = new Map<string, { id: string; friendlyName?: string }>();
  if (wallets.length === 0) {
    return byWallet;
  }
  try {
    const res = await axios.get(
      getApiRoute('nodes'), {
      params: {
        page: 0,
        size: wallets.length,
        filters: JSON.stringify({
          address: {
            value: wallets.join(','),
            operator: 'terms'
          }
        }),
      }
    }
    );
    const nodes: { _source: Node }[] = res.data?.nodes ?? [];
    for (const { _source: node } of nodes) {
      if (node?.id && node.address) {
        byWallet.set(node.address.toLowerCase(), { id: node.id, friendlyName: node.friendlyName });
      }
    }
  } catch (err) {
    console.error('Failed to resolve nodes for wallets:', err);
  }
  return byWallet;
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
              // Contract getLocks filters payer/token with OR, so it leaks other payers' locks and
              // other tokens. Narrow to this user's locks for this token client-side.
              const allLocks = await ocean.getLocks(token.address, account.address!, spender);
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

      // Enrich each spender with its node id. Collect the unique wallets (a wallet can
      // appear across multiple tokens) and resolve them all in a single request, then map
      // results back onto every matching spender.
      const uniqueWallets = [...new Set(spenderInfos.map((info) => info.spender))];
      const nodeByWallet = await fetchNodesByWallets(uniqueWallets);
      setSpenders((current) =>
        current.map((info) => {
          const node = nodeByWallet.get(info.spender.toLowerCase());
          return node ? { ...info, nodeId: node.id, nodeFriendlyName: node.friendlyName } : info;
        })
      );
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
