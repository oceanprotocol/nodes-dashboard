import { NODE_URL } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { getNodeEnvs } from '@/services/nodeService';
import { getSupportedTokens } from '@/constants/tokens';
import { ComputeEnvironment } from '@/types/environments';
import { Authorizations, EscrowLock } from '@/types/payment';
import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react';

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

      let envs: ComputeEnvironment[] = [];
      try {
        envs = (await getNodeEnvs(NODE_URL)) as ComputeEnvironment[];
      } catch (err) {
        console.warn('Failed to load compute environments for escrow spenders:', err);
      }
      const spenderAddresses = dedupeAddresses(envs.map((env) => env.consumerAddress));

      const spenderInfos = (
        await Promise.all(
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
        )
      ).filter((info): info is EscrowSpenderInfo => info !== null);
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
