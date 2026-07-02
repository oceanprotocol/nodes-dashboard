import { ComputeJob } from '@/types/jobs';
import { formatDateTime } from '@/utils/formatters';

// My Jobs reads from the indexed backend, which lags the node by a few seconds after a job starts.
// We stash the just-submitted job in sessionStorage so the consumer page can show it immediately
// and reconcile once the indexer catches up.
const STORAGE_KEY = 'runjob:optimistic';

export type OptimisticJobSeed = {
  jobId: string;
  consumer: string;
  environmentId: string;
  isFree: boolean;
  // unix seconds, matching the indexed API's dateCreated unit
  dateCreated: number;
  maxJobDuration: number;
};

export function stashOptimisticJob(seed: OptimisticJobSeed): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch {
    // sessionStorage may be unavailable (private mode); the optimistic row is best-effort.
  }
}

export function readOptimisticJob(): OptimisticJobSeed | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OptimisticJobSeed;
    return parsed?.jobId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOptimisticJob(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Build a table row shaped like the consumer-jobs sanitized data (id, startTime, statusText, ...).
// `index` is filled in by the table context when merging.
export function buildOptimisticRow(seed: OptimisticJobSeed): ComputeJob & { id: string; startTime: string } {
  return {
    id: seed.jobId,
    jobId: seed.jobId,
    owner: seed.consumer,
    environmentId: seed.environmentId,
    environment: seed.environmentId,
    isFree: seed.isFree,
    dateCreated: seed.dateCreated,
    startTime: formatDateTime(seed.dateCreated),
    maxJobDuration: seed.maxJobDuration,
    statusText: 'pending',
    status: 0,
    isRunning: false,
    isStarted: false,
  } as unknown as ComputeJob & { id: string; startTime: string };
}
