import {
  getOnboardingAuthMessage,
  OnboardingAnswers,
  OnboardingRequestError,
  submitOnboardingAnswers,
} from '@/lib/onboarding';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createWalletAuthSession } from '@/lib/wallet-auth';
import { WALLET_AUTH_ERROR } from '@/types/wallet-auth';
import { useCallback } from 'react';

const onboardingAuth = createWalletAuthSession(getOnboardingAuthMessage);

const getAuthRejection = (error: unknown) => {
  if (!(error instanceof OnboardingRequestError)) {
    return null;
  }
  const body = error.body as { error?: unknown; serverTime?: unknown } | null;
  return body?.error === WALLET_AUTH_ERROR ? body : null;
};

/** Saves the onboarding answers as `address`, proving ownership with a wallet signature. */
export function useOnboardingSubmit(address: string) {
  const { signMessage } = useOceanAccount();

  return useCallback(
    (answers: OnboardingAnswers) =>
      onboardingAuth.request(
        address,
        signMessage,
        (auth) => submitOnboardingAnswers(address, answers, auth),
        getAuthRejection
      ),
    [address, signMessage]
  );
}
