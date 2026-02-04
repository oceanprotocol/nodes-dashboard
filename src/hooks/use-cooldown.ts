import { useCallback, useEffect, useRef, useState } from 'react';

type UseCooldownReturn = {
  initiateCooldown: () => void;
  isCoolingDown: boolean;
  remainingCooldown: number;
};

/**
 * Hook that implements a cooldown timer.
 * @param cooldownSeconds - The cooldown duration in seconds.
 * @returns An object containing the cooldown state and a function to initiate the cooldown.
 */
const useCooldown = (cooldownSeconds: number): UseCooldownReturn => {
  const [remainingCooldown, setRemainingCooldown] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const initiateCooldown = useCallback(() => {
    clearTimer();
    setRemainingCooldown(cooldownSeconds);

    timerRef.current = setInterval(() => {
      setRemainingCooldown((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [cooldownSeconds, clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    initiateCooldown,
    isCoolingDown: remainingCooldown > 0,
    remainingCooldown,
  };
};

export default useCooldown;
