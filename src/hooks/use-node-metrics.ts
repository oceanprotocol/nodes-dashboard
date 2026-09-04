import { getNodeMetrics, isNodeMetricsUnsupported, isNodeRateLimited, isNodeUnreachable } from '@/services/nodeService';
import { asNodeMetricsSnapshot, NodeMetricsSnapshot } from '@/types/node-metrics';
import { useEffect, useState } from 'react';

// The node recomputes its C2D aggregate every C2D_METRICS_INTERVAL_SECONDS (10s by default), so a
// faster poll just re-reads the same numbers. 20s = 3 requests/min, and that budget is charged to
// the GATEWAY rather than to the browser: for a remote target ocean-node sees the gateway as the
// requester, so every dashboard viewer looking at this node shares one allowance on it.
const POLL_INTERVAL_MS = 20_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;

/**
 * Why there is nothing to show, when there is nothing to show. Only `unsupported` is worth telling
 * anyone about (and only the node's own operator, who can act on it) — the rest is either normal or
 * already reported by the node header.
 */
export type NodeMetricsStatus = 'loading' | 'ready' | 'unsupported' | 'unreachable';

/**
 * Polls a node's live resource snapshot over the gateway. Unauthenticated, so this runs for every
 * visitor rather than only the node owner.
 *
 * Failures are deliberately not surfaced as errors: most of the network still runs a build without
 * `getNodeMetrics`, the node may be offline, or metrics may be switched off node-side. All of those
 * are "no data", not something a viewer can act on, so the caller renders nothing. A transient
 * failure AFTER a good read keeps the last snapshot on screen and the panel's own "Updated 4m ago"
 * line is the honest staleness signal.
 */
export function useNodeMetrics({ multiaddrs, peerId }: { multiaddrs?: string[]; peerId?: string }): {
  snapshot: NodeMetricsSnapshot | null;
  status: NodeMetricsStatus;
} {
  const [snapshot, setSnapshot] = useState<NodeMetricsSnapshot | null>(null);
  const [status, setStatus] = useState<NodeMetricsStatus>('loading');
  // Stands in for the array identity, which changes on every parent render.
  const addrsKey = multiaddrs?.join('|') ?? '';

  useEffect(() => {
    if (!peerId) {
      return;
    }
    let cancelled = false;
    setSnapshot(null);
    setStatus('loading');

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const addrs = addrsKey ? addrsKey.split('|') : undefined;

    const run = async () => {
      while (!cancelled) {
        // A backgrounded tab still burns the target node's shared budget. Skip the read but keep the
        // loop alive, so the panel refreshes as soon as the viewer comes back.
        if (typeof document !== 'undefined' && document.hidden) {
          await delay(POLL_INTERVAL_MS);
          continue;
        }
        try {
          const result = await getNodeMetrics({ multiaddrs: addrs, peerId });
          if (cancelled) {
            return;
          }
          const parsed = asNodeMetricsSnapshot(result);
          if (parsed) {
            setSnapshot(parsed);
            setStatus('ready');
          }
        } catch (error) {
          if (cancelled) {
            return;
          }
          // Terminal, both of them: a node's build doesn't change under us, and an unreachable peer
          // is already the node header's story rather than a second red line down here.
          if (isNodeMetricsUnsupported(error)) {
            setStatus('unsupported');
            return;
          }
          if (isNodeUnreachable(error)) {
            setStatus('unreachable');
            return;
          }
          if (isNodeRateLimited(error)) {
            await delay(RATE_LIMIT_BACKOFF_MS);
            continue;
          }
          // Anything else is transient — keep the last snapshot and retry on the slow cadence.
        }
        if (cancelled) {
          return;
        }
        await delay(POLL_INTERVAL_MS);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [addrsKey, peerId]);

  return { snapshot, status };
}
