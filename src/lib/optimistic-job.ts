import { ComputeJob } from '@/types/jobs';
import { formatDateTime } from '@/utils/formatters';

const STORAGE_KEY = 'runjob:optimistic';

export type OptimisticJobSeed = {
  jobId: string;
  consumer: string;
  environmentId: string;
  peerId?: string;
  isFree: boolean;
  dateCreated: number;
  maxJobDuration: number;
};

export function stashOptimisticJob(seed: OptimisticJobSeed): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch {}
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

export function buildOptimisticRow(seed: OptimisticJobSeed): ComputeJob & { id: string; startTime: string } {
  return {
    id: seed.jobId,
    jobId: seed.jobId,
    owner: seed.consumer,
    environmentId: seed.environmentId,
    environment: seed.environmentId,
    peerId: seed.peerId,
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
