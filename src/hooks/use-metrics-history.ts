import { ContainerMetricsSnapshot, sampleFromSnapshot, UsageSample } from '@/types/runtime-metrics';
import { useEffect, useRef, useState } from 'react';

// ~30 samples at the existing poll cadences (4s for services, 15s for compute jobs) is 2-8 minutes
// of history — enough for a peak tick and a sparkline without holding an unbounded array.
const MAX_SAMPLES = 30;

/**
 * Client-side ring buffer of runtime-metrics samples, for the resource usage panel's peak ticks and
 * sparkline. Neither the node nor its API persists history — only the latest snapshot — so this is
 * the only place "last few minutes" comes from.
 *
 * Dedupes consecutive polls that landed between two node-side samples (collectedAt unchanged), and
 * resets when `resetKey` changes (e.g. navigating to a different service/job) so a new workload
 * doesn't inherit the previous one's history.
 */
export function useMetricsHistory(snapshot: ContainerMetricsSnapshot | null, resetKey: string): UsageSample[] {
  const [history, setHistory] = useState<UsageSample[]>([]);
  const resetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      setHistory([]);
    }
  }, [resetKey]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].collectedAt === snapshot.collectedAt) {
        return prev;
      }
      const next = [...prev, sampleFromSnapshot(snapshot)];
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
    });
  }, [snapshot]);

  return history;
}
