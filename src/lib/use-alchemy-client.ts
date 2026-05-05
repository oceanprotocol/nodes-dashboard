import { alchemyWalletTransport, createSmartWalletClient } from '@alchemy/wallet-apis';
import { getEmbeddedConnectedWallet, toViemAccount, useWallets } from '@privy-io/react-auth';
import { useEffect, useMemo, useState } from 'react';
import type { LocalAccount } from 'viem';
import { base, sepolia } from 'viem/chains';

type Call = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };

const chain = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? base : sepolia;

function useAlchemyClient() {
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const [signer, setSigner] = useState<LocalAccount | undefined>();

  useEffect(() => {
    if (!embeddedWallet) {
      setSigner(undefined);
      return;
    }
    toViemAccount({ wallet: embeddedWallet }).then(setSigner);
  }, [embeddedWallet]);

  return useMemo(() => {
    if (!signer) return null;
    return createSmartWalletClient({
      signer,
      transport: alchemyWalletTransport({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY! }),
      chain,
      paymaster: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID
        ? { policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID }
        : undefined,
    });
  }, [signer]);
}

export function useAlchemySendTransaction() {
  const client = useAlchemyClient();
  const [isLoading, setIsLoading] = useState(false);

  const sendTransaction = useMemo(() => {
    return async (callsInput: Call | Call[]) => {
      if (!client) throw new Error('Alchemy client not ready');
      const calls = Array.isArray(callsInput) ? callsInput : [callsInput];
      setIsLoading(true);
      try {
        const { id } = await client.sendCalls({ calls });
        return await client.waitForCallsStatus({ id });
      } finally {
        setIsLoading(false);
      }
    };
  }, [client]);

  return { sendTransaction, isLoading };
}
