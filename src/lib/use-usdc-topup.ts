import { BASE_CHAIN_ID } from '@/constants/chains';
import { tokenAddressesByChainId } from '@/constants/tokens';
import { getEmbeddedWallet } from '@/lib/embedded-wallet';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useFiatOnramp, useWallets, type PrivyErrorCode } from '@privy-io/react-auth';
import { useQuery } from '@tanstack/react-query';
import posthog from 'posthog-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPublicClient, erc20Abi, formatUnits, http } from 'viem';
import { base } from 'viem/chains';

// Card -> USDC on Base through Privy's fiat on-ramp (Stripe).

// Stripe's EU Travel Rule check starts at 1,000 EUR and asks the destination to prove ownership with a
// signature. Until we know the smart account passes it, prefill below the threshold.
// Only a prefill: the user can still change the amount inside Privy's modal.
export const MAX_TOPUP_USDC = 950;

/** Amount the profile top-up opens with when there is no shortfall to cover. */
export const DEFAULT_TOPUP_USDC = 20;

// Stripe has no testnets, so the on-ramp always delivers on Base mainnet, even when the app runs on Sepolia.
// Outside production the purchase itself runs in Privy's sandbox environment.
export const BASE_CAIP2 = 'eip155:8453';
export const BASE_USDC = tokenAddressesByChainId[BASE_CHAIN_ID].USDC;
export const ONRAMP_ENVIRONMENT = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'production' : 'sandbox';

/** The user closed Privy's modal. Not a failure worth an error toast. */
export const TOPUP_USER_EXITED = 'user_exited';

export type TopupDestination = 'sca' | 'embedded';

/** Where the top-up was started from, so the PostHog funnel can be split by entry point. */
export type TopupSource = 'profile' | 'dev_page';

export type TopupResult = {
  address: string;
  amount: number;
  /** 'confirmed' means the user reached the provider's success step, NOT that the USDC is on-chain. */
  result: 'submitted' | 'confirmed';
};

export class FiatTopupError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'FiatTopupError';
    this.code = code;
  }
}

// Privy rejects a closed on-ramp modal with a bare Error('User exited flow'): no code to match on.
const PRIVY_USER_EXITED_MESSAGE = 'User exited flow';

// Privy errors carry `privyErrorCode` (e.g. onramp_payment_method_declined); RPC-style errors carry `code`.
function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('privyErrorCode' in error && typeof error.privyErrorCode === 'string') return error.privyErrorCode;
  if ('code' in error && (typeof error.code === 'string' || typeof error.code === 'number')) return String(error.code);
  if (error instanceof Error && error.message === PRIVY_USER_EXITED_MESSAGE) return TOPUP_USER_EXITED;
  return undefined;
}

const IDENTITY_VERIFICATION_MESSAGE = 'Identity verification is needed to continue.';

type PrivyErrorCodeValue = `${PrivyErrorCode}`;

// PrivyErrorCode only exists in Privy's type declarations, not in its runtime exports, so the keys are its
// string values; the type still rejects a misspelled code.
const TOPUP_ERROR_MESSAGES: Partial<Record<PrivyErrorCodeValue, string>> = {
  onramp_payment_method_declined: 'Your card was declined. Try another card.',
  transaction_limit_reached: "You've reached your purchase limit. Try a smaller amount.",
  onramp_identity_verification_required: IDENTITY_VERIFICATION_MESSAGE,
  onramp_minimum_identity_verification_required: IDENTITY_VERIFICATION_MESSAGE,
  onramp_document_verification_required: IDENTITY_VERIFICATION_MESSAGE,
  onramp_wallet_ownership_required: "We couldn't verify this wallet for the purchase.",
  onramp_quote_expired: 'The quote expired. Please try again.',
};

const hasTopupErrorMessage = (code: string): code is PrivyErrorCodeValue => code in TOPUP_ERROR_MESSAGES;

export const getTopupErrorMessage = (code?: string): string =>
  (code && hasTopupErrorMessage(code) && TOPUP_ERROR_MESSAGES[code]) ||
  'Top-up failed. Please try again or use another payment method.';

export function useUsdcTopup() {
  const { user } = useOceanAccount();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedWallet(wallets);
  const { fund } = useFiatOnramp();

  // EOA users run without a Privy session (src/lib/use-injected-wallet.ts), which the funding flow needs.
  const canTopup = user?.type === 'sca';
  const scaAddress = user?.type === 'sca' ? user.address : undefined;
  const embeddedAddress = embeddedWallet?.address;

  const topup = useCallback(
    async ({
      amountUsdc,
      destination,
      source,
    }: {
      amountUsdc: number;
      destination: TopupDestination;
      source: TopupSource;
    }): Promise<TopupResult> => {
      const address = destination === 'sca' ? scaAddress : embeddedAddress;
      if (!canTopup || !address) {
        throw new FiatTopupError('Card top-up is not available for this account', 'topup_unavailable');
      }
      if (!(amountUsdc > 0)) {
        throw new FiatTopupError('Amount must be greater than 0', 'invalid_amount');
      }
      const amount = Math.min(Math.ceil(amountUsdc), MAX_TOPUP_USDC);

      posthog.capture('fiat_topup_started', { destination, amount, source });
      try {
        const { status } = await fund({
          source: { assets: ['usd', 'eur'], defaultAsset: 'eur' },
          destination: { chain: BASE_CAIP2, asset: BASE_USDC.address, address },
          environment: ONRAMP_ENVIRONMENT,
          defaultAmount: String(amount),
        });
        posthog.capture('fiat_topup_result', { result: status, destination, amount, source });
        return { address, amount, result: status };
      } catch (error) {
        const code = getErrorCode(error);
        const message = error instanceof Error ? error.message : String(error);
        posthog.capture('fiat_topup_error', { code, message, source });
        throw new FiatTopupError(message, code);
      }
    },
    [canTopup, embeddedAddress, fund, scaAddress]
  );

  return { canTopup, embeddedWallet, scaAddress, topup };
}

// Its own client on purpose: getRpc() follows NEXT_PUBLIC_APP_ENV (Sepolia in dev), but the on-ramp always
// delivers on Base mainnet. viem's default transport for `base` is the public mainnet.base.org endpoint.
const baseClient = createPublicClient({ chain: base, transport: http() });

export function useBaseUsdcBalance(
  address: string | undefined,
  { refetchInterval }: { refetchInterval?: number } = {}
) {
  const query = useQuery({
    queryKey: ['base-usdc-balance', address?.toLowerCase()],
    enabled: !!address,
    refetchInterval: refetchInterval ?? false,
    queryFn: () =>
      baseClient.readContract({
        address: BASE_USDC.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }),
  });

  return {
    balance: query.data,
    error: query.error,
    formatted: query.data === undefined ? undefined : formatUnits(query.data, BASE_USDC.decimals),
    loading: query.isFetching,
    refetch: query.refetch,
  };
}

const ARRIVAL_POLL_INTERVAL_MS = 5000;
const ARRIVAL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Watches an address's Base USDC balance after a purchase. fund() resolving says nothing about delivery,
 * so the chain is the only signal: `watch()` takes the last known balance as the baseline, polls, and
 * calls `onArrived` on the first increase or `onTimeout` once the window closes.
 */
export function useUsdcArrival(
  address: string | undefined,
  { onArrived, onTimeout }: { onArrived: (delta: string) => void; onTimeout: () => void }
) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const baseline = useRef<bigint | undefined>(undefined);
  const { balance } = useBaseUsdcBalance(address, {
    refetchInterval: deadline === null ? undefined : ARRIVAL_POLL_INTERVAL_MS,
  });

  // Latest callbacks, so the effects below don't re-arm on every render of the caller.
  const callbacks = useRef({ onArrived, onTimeout });
  useEffect(() => {
    callbacks.current = { onArrived, onTimeout };
  });

  // The pre-purchase balance, read on mount: a fresh read now could already include the delivery.
  const watch = useCallback(() => {
    baseline.current = balance;
    setDeadline(Date.now() + ARRIVAL_TIMEOUT_MS);
  }, [balance]);

  useEffect(() => {
    if (deadline === null || balance === undefined) return;
    if (baseline.current === undefined) {
      baseline.current = balance;
      return;
    }
    if (balance > baseline.current) {
      const delta = formatUnits(balance - baseline.current, BASE_USDC.decimals);
      baseline.current = balance;
      setDeadline(null);
      callbacks.current.onArrived(delta);
    }
  }, [balance, deadline]);

  useEffect(() => {
    if (deadline === null) return;
    const timer = setTimeout(() => {
      setDeadline(null);
      callbacks.current.onTimeout();
    }, deadline - Date.now());
    return () => clearTimeout(timer);
  }, [deadline]);

  return { watch, watching: deadline !== null };
}
