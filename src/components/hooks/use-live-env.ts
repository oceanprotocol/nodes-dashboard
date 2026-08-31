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
/**
 * The answer a live read gives back, WITH where it came from.
 *
 * A bare env couldn't say: the hook falls back to the backend snapshot whenever the node can't be
 * reached (P2P not ready, no dialable address, dial threw, env not in the node's list), and a caller
 * that only got an env had no way to tell "the node says this" from "nobody asked the node". So
 * `resolveLaunchEnv` was validating the stale snapshot against itself — always passing, then failing
 * at serviceStart. Callers that must not act on a guess check `live` before they commit.
 */
export type LiveEnvRead = {
  /** The environment to price/launch from — the node's copy when `live`, the snapshot otherwise. */
  env: ComputeEnvironment | undefined | null;
  /** True only when this env came from the node itself, on this read or a recent cached one. */
  live: boolean;
  /** When the underlying node read landed (epoch ms); 0 when there has never been one. */
  at: number;
  /**
   * Why `live` is false, so a caller can say something true and actionable instead of guessing.
   * `unreachable` and `unidentified` are NOT the same failure: the first is a connection the user can
   * retry, the second is the node answering with a list this environment is not in — retrying that
   * forever would never help, and telling the user to check their connection would be a lie.
   */
  reason: 'live' | 'not-ready' | 'unreachable' | 'unidentified';
};

/**
 * Find this environment in the node's own list.
 *
 * An exact id match is not enough on its own. ocean-node builds the id as
 * `engineHash + '-' + hash(JSON.stringify(env.fees) + envIdSuffix)` (compute_engine_docker.ts, in the
 * loop that creates each environment), so the half AFTER the dash is derived from the environment's
 * FEES — when those change the id changes with them, and an id held from the backend snapshot stops
 * matching the node's current one. Exact-matching alone therefore goes null and every read silently
 * falls back to the snapshot, which is precisely what this hook exists to prevent.
 *
 * Note what the two halves actually are, because the obvious reading is wrong: the head is
 * `engineHash`, which is `hash(nodeId)` for a local engine — ONE value shared by every environment
 * that node offers, not the environment's own identity. (inference-context's `envMatches` calls it
 * "the environment's real identity" and matches on it with a bare `.find()`; on a node offering more
 * than one environment that silently restores the WRONG one. Worth fixing there too — it is not in
 * this hook's reach.) So a head comparison narrows to "some environment on this node" and nothing
 * more, and the only case it can settle honestly is a node offering exactly one.
 *
 * Hence: exact first, then the single-environment case, then give up. Returning a guess here would
 * price and launch against another environment's free units.
 */
function findEnvById(envs: ComputeEnvironment[], id: string): ComputeEnvironment | null {
  const exact = envs.find((env) => env.id === id);
  if (exact) {
    return exact;
  }
  // Same node (we dialed it by peer id), and it offers one environment — then that is ours, whatever
  // its fees did to the id. With more than one there is nothing left in the id to tell them apart.
  const sameNode = envs.filter((env) => env.id.split('-')[0] === id.split('-')[0]);
  return sameNode.length === 1 ? sameNode[0] : null;
}

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
  // The dial in flight, WITH the env/node key it was started for — an unkeyed promise could be
  // coalesced onto by a caller asking about a different environment (see refresh).
  const inFlightRef = useRef<{
    key: string;
    promise: Promise<{ env: ComputeEnvironment | null; reached: boolean }>;
  } | null>(null);
  const fetchedAtRef = useRef(0);
  // Dials are numbered so a slower EARLIER one can't overwrite a later one's answer. A forced read
  // deliberately runs alongside an unforced dial for the same env (it must not inherit a possibly
  // pre-TTL answer), so two can be open at once and finish in either order; without this the chip
  // click's older `inUse` could land on top of the numbers Continue just validated.
  const dialSeqRef = useRef(0);
  const publishedSeqRef = useRef(0);

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
    // Reset the watermark so the next env's first answer can publish, but NOT the counter itself:
    // numbers must stay globally unique. Zeroing both let an A → B → A switch hand a fresh dial the
    // same number one still-open A dial already had, and `seq > published` then dropped the newer
    // answer for good.
    publishedSeqRef.current = 0;
  }, [envId, peerId]);

  const refresh = useCallback(
    async (force = false): Promise<LiveEnvRead> => {
      // Whatever we can say WITHOUT reaching the node. `live` is true only when a previous read of
      // this same env/node landed and is still held in `latestRef` — the reset effect clears it the
      // moment either changes, so a cached hit can never describe a different environment.
      const fallback = (reason: LiveEnvRead['reason']): LiveEnvRead =>
        latestRef.current
          ? { env: latestRef.current, live: true, at: fetchedAtRef.current, reason: 'live' }
          : { env: environment, live: false, at: 0, reason };
      if (!isReady || !environment || !nodeInfo?.id) {
        return fallback('not-ready');
      }
      // What THIS call is asking about, checked against the live key before any answer is used.
      const callKey = keyOf(environment.id, nodeInfo.id);
      // Coalesce: a burst of clicks shares the one dial already in flight — but only a dial started
      // for the SAME env/node, which is why the key is stored alongside the promise. Comparing the
      // caller's key against `activeKeyRef` instead only proved the caller was still current, not that
      // the shared dial was asking our question: switch env A → B while A's dial is open and B's
      // Continue got A's answer back as its own. A forced read never joins an unforced dial either —
      // `force` is the caller saying the cached value is not good enough, and handing it a read that
      // may predate the TTL would quietly break exactly the guarantee it asked for.
      const shared = inFlightRef.current;
      if (shared && shared.key === callKey && !force) {
        const joined = await shared.promise;
        // Re-check the ACTIVE key on the way out, not just that the dial asked our question: the user
        // may have moved to another env while it was open, in which case the dial's own publish was
        // skipped and this answer describes something no longer on screen.
        if (joined.env && activeKeyRef.current === callKey) {
          return { env: joined.env, live: true, at: fetchedAtRef.current, reason: 'live' };
        }
        return fallback(joined.reached ? 'unidentified' : 'unreachable');
      }
      if (!force && Date.now() - fetchedAtRef.current < LIVE_TTL_MS && latestRef.current) {
        return fallback('live');
      }
      setRefreshing(true);
      // The env/node this particular dial is asking about. A dial outlives a chip click, so by the time
      // it answers the user may have moved to another env or node — and the reset effect above has
      // already cleared the refs for the new one. Publishing regardless would put the PREVIOUS env's
      // `inUse` behind the current one, which is what this hook exists to stop: the flow would price and
      // launch against the wrong device list, and the stamped `fetchedAtRef` would suppress the
      // corrective re-read for a whole TTL.
      // Answered-but-not-in-the-list is reported apart from never-answered: the caller can act on the
      // first (pick another environment) and only retry the second.
      const seq = ++dialSeqRef.current;
      const request = (async (): Promise<{ env: ComputeEnvironment | null; reached: boolean }> => {
        try {
          const envs = (await getEnvs(toNodeUri(nodeInfo))) as ComputeEnvironment[];
          const fresh = findEnvById(envs ?? [], environment.id);
          if (fresh && activeKeyRef.current === callKey && seq > publishedSeqRef.current) {
            publishedSeqRef.current = seq;
            latestRef.current = fresh;
            fetchedAtRef.current = Date.now();
            setLiveEnv(fresh);
          }
          return { env: fresh, reached: true };
        } catch {
          // Node unreachable — keep the snapshot rather than stranding the user on a dial failure.
          // Reported as `live: false` by the caller below, so a commit point can tell this apart from
          // a real answer instead of validating the stale snapshot against itself.
          return { env: null, reached: false };
        }
      })();
      // Publish first, THEN attach the cleanup. Clearing from inside the body's own `finally` would
      // run before this assignment for anything that threw synchronously ahead of the first `await`
      // — the ref would keep a settled promise forever and every later call would coalesce onto it,
      // silently killing live reads for the rest of the session.
      inFlightRef.current = { key: callKey, promise: request };
      const settled = request.finally(() => {
        setRefreshing(false);
        // Only retract OUR dial: a later call may already have replaced it, and clearing that one
        // would let the next caller start a third read against a node already answering two.
        if (inFlightRef.current?.promise === request) {
          inFlightRef.current = null;
        }
      });
      const result = await settled;
      // Same guard on the way out: if the env/node changed while this dial was open, its answer is not
      // about what the caller is now acting on. Fall back to whatever describes the CURRENT key.
      if (result.env && activeKeyRef.current === callKey) {
        return { env: result.env, live: true, at: fetchedAtRef.current, reason: 'live' };
      }
      return fallback(result.reached ? 'unidentified' : 'unreachable');
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
