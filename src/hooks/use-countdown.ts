import { useCallback, useEffect, useRef, useState } from 'react';

type UseCountdownReturn = {
  initiateCountdown: () => void;
  isCountingDown: boolean;
  remainingCountdown: number;
};

/**
 * Hook that implements a countdown timer.
 * @param countdownSeconds - The countdown duration in seconds.
 * @returns An object containing the countdown state and a function to initiate the countdown.
 */
const useCountdown = (countdownSeconds: number): UseCountdownReturn => {
  const [remainingCountdown, setRemainingCountdown] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const initiateCountdown = useCallback(() => {
    clearTimer();
    setRemainingCountdown(countdownSeconds);

    timerRef.current = setInterval(() => {
      setRemainingCountdown((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [countdownSeconds, clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    initiateCountdown,
    isCountingDown: remainingCountdown > 0,
    remainingCountdown,
  };
};

export default useCountdown;
