import { ComputeEnvironment } from '@/types/environments';

/**
 * Ocean-node's fallback service cap (`serviceOnDemand.maxDurationSeconds`, 24 h) for nodes too old
 * to advertise `maxServiceDuration`. Falling back to `maxJobDuration` instead would be wrong in the
 * dangerous direction: it is a compute-job limit, frequently far larger than the service ceiling the
 * node actually enforces (604800 vs 86400 on the dev H200), so the UI would offer windows that
 * SERVICE_START rejects only after the user has paid.
 */
const NODE_DEFAULT_MAX_SERVICE_DURATION_SECONDS = 86400;

/**
 * Duration bounds for a SERVICE (service-on-demand: inference, templates, apps) on `environment`.
 *
 * Services are bounded by `minServiceDuration` / `maxServiceDuration`, NOT by the
 * `minJobDuration` / `maxJobDuration` pair — those govern compute jobs and are read only by
 * `core/compute/*` node-side. The two differ per environment, so using the job fields here shows the
 * wrong range and lets the UI accept durations the node rejects at SERVICE_START.
 *
 * `minServiceDuration` is also the node's BILLING floor: a service costs
 * `max(duration, min)` rounded up to whole minutes. Quote with the same value returned here, or the
 * escrow deposit under-funds and `createLock` reverts.
 *
 * Both fields arrived together in ocean-node; a node that advertises neither is handled by the
 * fallbacks. `min` falls back to `minJobDuration`, which is exactly what such a node bills at.
 */
export function serviceDurationBounds(
  environment: Pick<
    ComputeEnvironment,
    'minServiceDuration' | 'maxServiceDuration' | 'minJobDuration' | 'maxJobDuration'
  >
): { min: number; max: number } {
  const min = environment.minServiceDuration ?? environment.minJobDuration ?? 0;
  const max =
    environment.maxServiceDuration ??
    Math.min(environment.maxJobDuration ?? Infinity, NODE_DEFAULT_MAX_SERVICE_DURATION_SECONDS);
  return { min, max };
}
