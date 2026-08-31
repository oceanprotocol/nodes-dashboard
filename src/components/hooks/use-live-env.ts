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

  // Identifies WHICH env/node a read was asked for, so a response that lands after the caller moved on
  // can be told apart from one that still describes what's on screen.
  const keyOf = (env?: string, peer?: string) => `${env ?? ''}\u0000${peer ?? ''}`;
  const activeKeyRef = useRef(keyOf(envId, peerId));
  activeKeyRef.current = keyOf(envId, peerId);

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
      // What THIS call is asking about, checked against the live key before any answer is used.
      const callKey = keyOf(environment.id, nodeInfo.id);
      // Coalesce: a burst of clicks shares the one dial already in flight. Guarded by the same key as
      // the publish below — the shared dial may have been started for a DIFFERENT env/node, and handing
      // its answer back here would hand the caller (Continue / pay) the wrong env to launch from.
      if (inFlightRef.current) {
        const shared = await inFlightRef.current;
        const usable = activeKeyRef.current === callKey ? shared : null;
        return usable ?? latestRef.current ?? environment;
      }
      if (!force && Date.now() - fetchedAtRef.current < LIVE_TTL_MS) {
        return fallback;
      }
      setRefreshing(true);
      // The env/node this particular dial is asking about. A dial outlives a chip click, so by the time
      // it answers the user may have moved to another env or node — and the reset effect above has
      // already cleared the refs for the new one. Publishing regardless would put the PREVIOUS env's
      // `inUse` behind the current one, which is what this hook exists to stop: the flow would price and
      // launch against the wrong device list, and the stamped `fetchedAtRef` would suppress the
      // corrective re-read for a whole TTL.
      const request = (async () => {
        try {
          const envs = (await getEnvs(toNodeUri(nodeInfo))) as ComputeEnvironment[];
          const fresh = envs?.find((env) => env.id === environment.id) ?? null;
          if (fresh && activeKeyRef.current === callKey) {
            latestRef.current = fresh;
            fetchedAtRef.current = Date.now();
            setLiveEnv(fresh);
          }
          return fresh;
        } catch {
          // Node unreachable — keep the snapshot rather than stranding the user on a dial failure.
          return null;
        }
      })();
      // Publish first, THEN attach the cleanup. Clearing from inside the body's own `finally` would
      // run before this assignment for anything that threw synchronously ahead of the first `await`
      // — the ref would keep a settled promise forever and every later call would coalesce onto it,
      // silently killing live reads for the rest of the session.
      inFlightRef.current = request;
      const settled = request.finally(() => {
        setRefreshing(false);
        inFlightRef.current = null;
      });
      const result = await settled;
      // Same guard on the way out: if the env/node changed while this dial was open, its answer is not
      // about what the caller is now acting on. Fall back to whatever describes the CURRENT key.
      return (activeKeyRef.current === callKey ? result : null) ?? latestRef.current ?? environment;
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
