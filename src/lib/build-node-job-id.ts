import { ComputeJob } from '@/types/jobs';

// ocean-node compute job ids are `<clusterHash>-<uuid>`, where the cluster hash is the first segment
// of the environment id (env id = `<clusterHash>-<envHash>`; see ocean-node compute_engine_docker).
// The indexer stores the bare `<uuid>`, but a just-run (optimistic) row carries the full
// `<clusterHash>-<uuid>` straight from computeStart. Strip a leading duplicate cluster hash so we
// always send exactly `<clusterHash>-<uuid>` to the node, whichever form we happen to hold.
export function buildNodeJobId(job: Pick<ComputeJob, 'environment' | 'environmentId' | 'jobId'>): string {
  const clusterHash = (job.environment ?? job.environmentId ?? '').split('-')[0];
  if (!clusterHash) {
    return job.jobId;
  }
  const bare = job.jobId.startsWith(`${clusterHash}-`) ? job.jobId.slice(clusterHash.length + 1) : job.jobId;
  return `${clusterHash}-${bare}`;
}
