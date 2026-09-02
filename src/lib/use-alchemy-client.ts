import { getRpc } from '@/lib/constants';
import { getEmbeddedWallet } from '@/lib/embedded-wallet';
import { alchemyWalletTransport, createSmartWalletClient, type SmartWalletClient } from '@alchemy/wallet-apis';
import { toViemAccount, useWallets } from '@privy-io/react-auth';
import { useEffect, useMemo, useState } from 'react';
import { createPublicClient, http, zeroAddress, type LocalAccount } from 'viem';
import { base, sepolia } from 'viem/chains';

type Call = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };

const chain = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? base : sepolia;

// A smart account is counterfactual until its first UserOp: the address is known but nothing is
// deployed at it. Ocean Node verifies our signatures by calling isValidSignature on that address
// (nonceHandler.isERC1271Valid), which can only fail while there is no code there — so a user who
// has never transacted gets "consumer address and nonce signature mismatch" on every signed
// command. Any UserOp carries the account's initCode, so a sponsored no-op call is the cheapest way
// to materialise it. The no-op targets the zero address, NOT the account: Modular Account v2 rejects
// execute(target == address(this)) inside validateUserOp (SelfCallRecursionDepthExceeded), which the
// EntryPoint reports as "AA23 reverted".
async function deployAccount(client: SmartWalletClient, account: `0x${string}`): Promise<void> {
  const code = await createPublicClient({ chain, transport: http(getRpc()) }).getCode({ address: account });
  if (code) return;
  const { id } = await (client as any).sendCalls({ calls: [{ to: zeroAddress, data: '0x' }], account });
  const result = await client.waitForCallsStatus({ id });
  if (result.status !== 'success') {
    throw new Error(`Could not activate your wallet (status: ${result.status}). Please try again.`);
  }
}

// One deploy per account per session: concurrent signers await the same promise instead of each
// spending a sponsored UserOp (the later ones would revert as "sender already constructed").
// A failure is evicted so the next signature retries.
const deployments = new Map<string, Promise<void>>();

function ensureAccountDeployed(client: SmartWalletClient, account: `0x${string}`): Promise<void> {
  const key = account.toLowerCase();
  let pending = deployments.get(key);
  if (!pending) {
    pending = deployAccount(client, account).catch((error) => {
      deployments.delete(key);
      throw error;
    });
    deployments.set(key, pending);
  }
  return pending;
}

function useAlchemyClient(): { client: SmartWalletClient | null; accountAddress?: `0x${string}` } {
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedWallet(wallets);
  const [signer, setSigner] = useState<LocalAccount | undefined>();
  const [accountAddress, setAccountAddress] = useState<`0x${string}` | undefined>();

  useEffect(() => {
    if (!embeddedWallet) {
      setSigner(undefined);
      return;
    }
    toViemAccount({ wallet: embeddedWallet }).then((s) => setSigner(s as unknown as LocalAccount));
  }, [embeddedWallet]);

  const client = useMemo((): SmartWalletClient | null => {
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

  // wallet-apis defaults to EIP-7702 (account == signer EOA), but Alchemy users' funds live in
  // their existing smart contract account. Resolve that account for the signer and use it as the
  // identity + the `account` for all calls, so the app shows the same address/balance as before.
  useEffect(() => {
    if (!client) {
      setAccountAddress(undefined);
      return;
    }
    let cancelled = false;
    (client as any)
      .requestAccount()
      .then((acc: { address: `0x${string}` }) => {
        if (!cancelled) setAccountAddress(acc.address);
      })
      .catch((e: unknown) => console.error('[alchemy] requestAccount failed', e));
    return () => {
      cancelled = true;
    };
  }, [client]);

  return { client, accountAddress };
}

export function useAlchemySendTransaction() {
  const { client, accountAddress } = useAlchemyClient();
  const [isLoading, setIsLoading] = useState(false);

  const sendTransaction = useMemo(() => {
    return async (callsInput: Call | Call[]) => {
      if (!client || !accountAddress) throw new Error('Alchemy client not ready');
      const calls = Array.isArray(callsInput) ? callsInput : [callsInput];
      setIsLoading(true);
      try {
        // Execute from the smart account, not the default EIP-7702 signer address.
        const { id } = await (client as any).sendCalls({ calls, account: accountAddress });
        const result = await client.waitForCallsStatus({ id });
        // waitForCallsStatus resolves (does not throw) on a reverted batch; surface it like tx.wait().
        if (result.status !== 'success') {
          throw new Error(
            result.status === 'failure'
              ? 'Transaction reverted on-chain'
              : `Transaction did not confirm (status: ${result.status})`
          );
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    };
  }, [client, accountAddress]);

  // ERC-1271 signature produced by the smart account (EIP-191), which the node verifies via the
  // account's isValidSignature. Do NOT keccak-pre-hash here (unlike the EOA path) — the node's
  // ERC-1271 check hashes the raw message itself (hashMessage(message)).
  const signMessage = useMemo(() => {
    return async (message: string): Promise<string> => {
      if (!client || !accountAddress) throw new Error('Alchemy client not ready');
      await ensureAccountDeployed(client, accountAddress);
      return await (client as any).signMessage({ message, account: accountAddress });
    };
  }, [client, accountAddress]);

  return { sendTransaction, isLoading, accountAddress, signMessage };
}
