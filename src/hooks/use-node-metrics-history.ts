import {
  getNodeMetricsHistory,
  isNodeMetricsHistoryUnavailable,
  isNodeMetricsUnsupported,
} from '@/services/nodeService';
import { asNodeMetricsHistory, NodeMetricsHistoryResult } from '@/types/node-metrics';
import { MetricsRange, rangeToWindow } from '@/utils/node-metrics-series';
import { useEffect, useRef, useState } from 'react';

export type NodeMetricsHistoryState = 'error' | 'loading' | 'ok' | 'unavailable';

/**
 * One-shot read of the node's hourly rollup per range — not a poll. The data only changes once an
 * hour (the node rolls the previous hour up at :05), and the payload is large enough that
 * re-fetching on a whim is rude to a gateway budget shared by every viewer.
 *
 * Unlike the live snapshot this DOES surface a state: the viewer picked a range, so silence would
 * read as a broken control rather than as "this node has nothing to say".
 */
export function useNodeMetricsHistory({
  enabled,
  multiaddrs,
  peerId,
  range,
}: {
  /** Gated on the live snapshot having succeeded, so an old node never eats a second 501. */
  enabled: boolean;
  multiaddrs?: string[];
  peerId?: string;
  range: MetricsRange;
}): { result: NodeMetricsHistoryResult | null; retry: () => void; state: NodeMetricsHistoryState } {
  const [result, setResult] = useState<NodeMetricsHistoryResult | null>(null);
  const [state, setState] = useState<NodeMetricsHistoryState>('loading');
  // Bumped by `retry` to re-run the effect for the same node and range. Only successful reads are
  // cached, so a retry after a failure always goes back to the network.
  const [attempt, setAttempt] = useState(0);
  const addrsKey = multiaddrs?.join('|') ?? '';
  // Toggling back to a range already fetched shouldn't re-pull half a megabyte. Cleared whenever the
  // node changes, since the cache itself is keyed only by range.
  const cacheRef = useRef<{ nodeKey: string; ranges: Partial<Record<MetricsRange, NodeMetricsHistoryResult>> }>({
    nodeKey: '',
    ranges: {},
  });

  useEffect(() => {
    if (!enabled || !peerId) {
      return;
    }
    const nodeKey = `${peerId}|${addrsKey}`;
    if (cacheRef.current.nodeKey !== nodeKey) {
      cacheRef.current = { nodeKey, ranges: {} };
    }
    const cached = cacheRef.current.ranges[range];
    if (cached) {
      setResult(cached);
      setState('ok');
      return;
    }

    let cancelled = false;
    setResult(null);
    setState('loading');

    const { startTime, stopTime } = rangeToWindow(range);
    getNodeMetricsHistory({ multiaddrs: addrsKey ? addrsKey.split('|') : undefined, peerId, startTime, stopTime })
      .then((raw) => {
        if (cancelled) {
          return;
        }
        const parsed = asNodeMetricsHistory(raw);
        if (!parsed) {
          setState('error');
          return;
        }
        cacheRef.current.ranges[range] = parsed;
        setResult(parsed);
        setState('ok');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // 503 means "disabled or no database", never "busy" — the section hides itself rather than
        // retrying. An old node reaching here at all would be a bug (the live poll gates us), but
        // classify it the same way so the section disappears instead of turning red.
        setState(isNodeMetricsHistoryUnavailable(error) || isNodeMetricsUnsupported(error) ? 'unavailable' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [addrsKey, attempt, enabled, peerId, range]);

  return { result, retry: () => setAttempt((previous) => previous + 1), state };
}
