import { COMPY_PER_USDC } from '@/constants/tokens';
import { readSwapContractState, type SwapContractState } from '@/lib/grants-swap';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useEffect, useState } from 'react';

export interface UseSwapRateReturn extends SwapContractState {
  loading: boolean;
}

/**
 * Swap contract state behind the convert form. The rate is owner-settable on chain (`setRate`), and
 * the payout is capped by the COMPY the contract still holds, so neither can be baked in at build
 * time. Read once per provider: the preview then stays plain arithmetic rather than an RPC round
 * trip per keystroke.
 */
export const useSwapRate = (): UseSwapRateReturn => {
  const { provider } = useOceanAccount();

  const [state, setState] = useState<SwapContractState>({ rate: COMPY_PER_USDC, paused: false });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!provider) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    readSwapContractState(provider).then((value) => {
      if (cancelled) {
        return;
      }
      setState(value);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [provider]);

  return { ...state, loading };
};
