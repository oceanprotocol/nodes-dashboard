import { NodeMetricsSnapshot, nodeSampleFromSnapshot, NodeUsageSample } from '@/types/node-metrics';
import { ContainerMetricsSnapshot, sampleFromSnapshot, UsageSample } from '@/types/runtime-metrics';
import { useCallback, useEffect, useRef, useState } from 'react';

// ~30 samples at the existing poll cadences (4s for services, 15s for compute jobs, 20s for a node)
// is 2-10 minutes of history — enough for a peak tick and a sparkline without holding an unbounded
// array.
const MAX_SAMPLES = 30;

/**
 * Client-side ring buffer of metrics samples, for a usage panel's peak ticks and sparklines. A live
 * snapshot is all the node exposes (the container command persists only the latest one), so this is
 * the only place "the last few minutes" comes from.
 *
 * Dedupes consecutive polls that landed between two node-side samples (`collectedAt` unchanged), and
 * resets when `resetKey` changes (e.g. navigating to a different service/job/node) so a new workload
 * doesn't inherit the previous one's history.
 *
 * `toSample` must be a stable module-level function — it is a dependency of the append effect, so an
 * inline lambda would re-append on every parent render.
 */
function useSnapshotHistory<S, T extends { collectedAt: number | string }>({
  resetKey,
  snapshot,
  toSample,
}: {
  resetKey: string;
  snapshot: S | null;
  toSample: (snapshot: S) => T;
}): T[] {
  const [history, setHistory] = useState<T[]>([]);
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
      // Built before the dedupe check rather than after it, because only the SAMPLE carries a
      // comparable `collectedAt` across both snapshot shapes (ISO string vs epoch ms). Both samplers
      // are pure, so React re-invoking this updater under StrictMode costs nothing.
      const sample = toSample(snapshot);
      if (prev.length > 0 && prev[prev.length - 1].collectedAt === sample.collectedAt) {
        return prev;
      }
      const next = [...prev, sample];
      return next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next;
    });
  }, [snapshot, toSample]);

  return history;
}

export function useMetricsHistory(snapshot: ContainerMetricsSnapshot | null, resetKey: string): UsageSample[] {
  return useSnapshotHistory({ resetKey, snapshot, toSample: sampleFromSnapshot });
}

/**
 * The node equivalent, fed by `useNodeMetrics`'s 20s poll. Named "samples" rather than "history" to
 * keep it apart from `useNodeMetricsHistory`, which reads the node's own hourly rollup.
 *
 * `excludeEnvIds` is forwarded into every sample's env-based math (see `nodeSampleFromSnapshot`) so a
 * node's auto-generated benchmark environment — which duplicates its sibling's cpu/ram/disk figures
 * rather than offering a second pool — never gets double-counted into the denominators the sparklines
 * and peak ticks plot against. Bound with `useCallback` rather than passed as an inline lambda:
 * `useSnapshotHistory`'s append effect keys off `toSample`'s identity, and a set that hasn't changed
 * must not look like a new function every render.
 */
export function useNodeUsageSamples(
  snapshot: NodeMetricsSnapshot | null,
  resetKey: string,
  excludeEnvIds?: Set<string>
): NodeUsageSample[] {
  const toSample = useCallback(
    (nodeSnapshot: NodeMetricsSnapshot) => nodeSampleFromSnapshot(nodeSnapshot, excludeEnvIds),
    [excludeEnvIds]
  );
  return useSnapshotHistory({ resetKey, snapshot, toSample });
}
