/**
 * Engine readiness and startup progress, as reported by ocean-node on a service job.
 *
 * `Running` means the container process started — nothing more. vLLM then spends minutes pulling
 * weights and warming the engine, and its forwarded port answers 503 (or refuses the connection)
 * for that entire window, so a consumer handed the URL at `Running` gets nothing but errors. The
 * node closes that gap: for the engines it recognises (see ocean-node `components/c2d/
 * serviceEngines`) it asks the workload itself whether it can serve requests, and reports the
 * verdict here along with how much of the model has downloaded.
 *
 * None of these fields are in @oceanprotocol/lib's `ServiceJob` type: the node returns them as
 * extra JSON keys, which survive the round trip untouched. They're read through the guards below so
 * a node that predates the feature — or one that doesn't recognise the image — degrades to `null`
 * rather than throwing, and the UI falls back to the old container-level status.
 */

export type ServiceReadinessState = 'waiting' | 'ready' | 'failing';

export interface ServiceReadiness {
  state: ServiceReadinessState;
  /** Which engine profile the node matched ('vllm'), so the UI can say what was checked. */
  engine?: string;
  /** Unix ms of the first successful check of THIS container (reset by a restart). */
  readySince?: number;
  lastCheckedAt?: number;
  consecutiveFailures?: number;
  /** Last response status. Absent when the connection itself failed (engine not listening yet). */
  httpStatus?: number;
  lastError?: string;
}

export interface ServiceImagePullProgress {
  phase: 'downloading' | 'extracting' | 'complete';
  downloadedBytes: number;
  totalBytes: number;
  /** Monotonic — the node clamps it, because Docker announces layer totals as the pull proceeds. */
  percent: number;
  layersTotal: number;
  layersDone: number;
  updatedAt: number;
}

/**
 * Model-weight download, read by the node from the container's own Hugging Face cache.
 *
 * `totalBytes`/`percent` are present only when the size could be established — the engine is
 * serving a Hub repo AND the Hub published a safetensors index for it. Pointed at a local path, an
 * object-store URI or an unindexed repo, only `downloadedBytes` arrives and the bar runs
 * indeterminate rather than showing a ratio against a guess.
 */
export interface ServiceModelDownload {
  modelId?: string;
  downloadedBytes: number;
  totalBytes?: number;
  percent?: number;
  filesComplete: number;
  filesInFlight: number;
  updatedAt: number;
}

const READINESS_STATES: ServiceReadinessState[] = ['waiting', 'ready', 'failing'];

/** Narrow-or-null reader for `job.readiness`. Null means "this node doesn't report readiness". */
export function getServiceReadiness(job: unknown): ServiceReadiness | null {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const readiness = (job as { readiness?: unknown }).readiness;
  if (!readiness || typeof readiness !== 'object') {
    return null;
  }
  const state = (readiness as { state?: unknown }).state;
  if (typeof state !== 'string' || !READINESS_STATES.includes(state as ServiceReadinessState)) {
    return null;
  }
  return readiness as ServiceReadiness;
}

/** Narrow-or-null reader for `job.imagePull`. Null also means "image was already cached". */
export function getImagePullProgress(job: unknown): ServiceImagePullProgress | null {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const pull = (job as { imagePull?: unknown }).imagePull;
  if (!pull || typeof pull !== 'object') {
    return null;
  }
  const p = pull as Record<string, unknown>;
  if (typeof p.percent !== 'number' || typeof p.downloadedBytes !== 'number') {
    return null;
  }
  return pull as ServiceImagePullProgress;
}

/** Narrow-or-null reader for `job.modelDownload`. */
export function getModelDownload(job: unknown): ServiceModelDownload | null {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const download = (job as { modelDownload?: unknown }).modelDownload;
  if (!download || typeof download !== 'object') {
    return null;
  }
  if (typeof (download as { downloadedBytes?: unknown }).downloadedBytes !== 'number') {
    return null;
  }
  return download as ServiceModelDownload;
}

/**
 * Whether the service can actually take requests.
 *
 * `true` for a node that reports no readiness at all — which covers both an older node and a
 * workload the node doesn't recognise. The old behaviour is the fallback, so those services keep
 * handing out their endpoint at `Running` rather than being gated forever on a signal that will
 * never arrive.
 */
export function isServiceReady(job: unknown): boolean {
  const readiness = getServiceReadiness(job);
  if (!readiness) {
    return true;
  }
  return readiness.state === 'ready';
}
