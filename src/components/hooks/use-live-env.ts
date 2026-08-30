import { useP2P } from '@/contexts/P2PContext';
import { toNodeUri } from '@/services/inference-launch';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a live read stays good enough to reuse. Chip clicks come in bursts (1x → 2x → 4x), and
 * a dial per click would be both slow and rude to the node; a forced refresh (`refresh(true)`)
 * ignores this and is what the commit points — Continue, and paying — use.
 */
const LIVE_TTL_MS = 15_000;

/**
 * Live `inUse` for one environment, read from the node itself.
 *
 * The env objects the wizard renders come from the incentive-backend `/envs` index (a poller-refreshed
 * snapshot, see run-job-envs-context), and the GPU units a launch requests are resolved from that
 * snapshot's `inUse` — by concrete resource id, always drawing the lowest-index free ones first
 * (buildGpuRequests). So a snapshot that missed a booking makes the dashboard name a device the node
 * knows is taken, and the node rejects the whole serviceStart ("Not enough available gpuN globally")
 * even when other units of the same type sit idle — after the escrow deposit tx has already run.
 *
 * This hook re-reads the environment straight from the node (same command the node-details page uses)
 * so both the numbers shown and the ids sent come from the authority on them.
 *
 * Best-effort by design: an unreachable node (P2P not ready, no dialable ws/wss addr, dial timeout)
 * leaves the snapshot in place and resolves to it, so the flow degrades to exactly today's behaviour
 * instead of blocking on a node that may never answer.
 */
export default function useLiveEnv(
  environment: ComputeEnvironment | undefined | null,
  nodeInfo: Pick<EnvNodeInfo, 'id' | 'multiaddrs'> | undefined | null
) {
  const { getEnvs, isReady } = useP2P();
  const [liveEnv, setLiveEnv] = useState<ComputeEnvironment | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Mirrors `liveEnv` for the callers that need the fresh value in the same tick they asked for it
  // (the Continue / pay handlers) — a setState is not readable until the next render.
  const latestRef = useRef<ComputeEnvironment | null>(null);
  const inFlightRef = useRef<Promise<ComputeEnvironment | null> | null>(null);
  const fetchedAtRef = useRef(0);

  const envId = environment?.id;
  const peerId = nodeInfo?.id;

  // Pointed at a different env/node: the previous live copy describes neither.
  useEffect(() => {
    setLiveEnv(null);
    latestRef.current = null;
    fetchedAtRef.current = 0;
  }, [envId, peerId]);

  const refresh = useCallback(
    async (force = false): Promise<ComputeEnvironment | undefined | null> => {
      const fallback = latestRef.current ?? environment;
      if (!isReady || !environment || !nodeInfo?.id) {
        return fallback;
      }
      // Coalesce: a burst of clicks shares the one dial already in flight.
      if (inFlightRef.current) {
        return (await inFlightRef.current) ?? latestRef.current ?? environment;
      }
      if (!force && Date.now() - fetchedAtRef.current < LIVE_TTL_MS) {
        return fallback;
      }
      setRefreshing(true);
      const request = (async () => {
        try {
          const envs = (await getEnvs(toNodeUri(nodeInfo))) as ComputeEnvironment[];
          const fresh = envs?.find((env) => env.id === environment.id) ?? null;
          if (fresh) {
            latestRef.current = fresh;
            fetchedAtRef.current = Date.now();
            setLiveEnv(fresh);
          }
          return fresh;
        } catch {
          // Node unreachable — keep the snapshot rather than stranding the user on a dial failure.
          return null;
        } finally {
          setRefreshing(false);
          inFlightRef.current = null;
        }
      })();
      inFlightRef.current = request;
      return (await request) ?? latestRef.current ?? environment;
    },
    [environment, getEnvs, isReady, nodeInfo]
  );

  return {
    /** The environment to render/price/launch from: the node's own copy once we have one. */
    env: liveEnv ?? environment,
    refresh,
    refreshing,
  };
}
