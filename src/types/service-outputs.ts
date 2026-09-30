/**
 * What a service left in /data/outputs, as ocean-node reports it on SERVICE_GET_STATUS. A service
 * started with an output bucket writes straight into the bucket; one without gets a zip of the folder
 * each time a container of it is removed (stop, session end, restart, recovery after a node crash),
 * kept until the environment's storage period after the session ends.
 *
 * None of this is typed by the pinned @oceanprotocol/lib (9.2.1), and older nodes omit it, hence the
 * guards: absence and any malformed entry read as "nothing", never throw.
 */
export type ServiceOutputArchive = {
  index: number;
  filename: string;
  /** Bytes. */
  filesize: number;
  /** Unix ms. */
  createdAt: number;
};

/** The bucket the service writes results to, when it was started with one. */
export function getOutputBucketId(job: unknown): string | null {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const bucketId = (job as { outputBucketId?: unknown }).outputBucketId;
  return typeof bucketId === 'string' && bucketId ? bucketId : null;
}

/** The service's output archives, newest first. */
export function getOutputArchives(job: unknown): ServiceOutputArchive[] {
  if (!job || typeof job !== 'object') {
    return [];
  }
  const archives = (job as { outputArchives?: unknown }).outputArchives;
  if (!Array.isArray(archives)) {
    return [];
  }
  return archives
    .filter(
      (a): a is ServiceOutputArchive =>
        !!a &&
        typeof a === 'object' &&
        Number.isInteger(a.index) &&
        a.index >= 0 &&
        typeof a.filename === 'string' &&
        typeof a.filesize === 'number' &&
        typeof a.createdAt === 'number'
    )
    .map(({ index, filename, filesize, createdAt }) => ({
      index,
      filename,
      filesize,
      createdAt,
    }))
    .sort((a, b) => b.index - a.index);
}
