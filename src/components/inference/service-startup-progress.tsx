import { getImagePullProgress, getModelDownload, getServiceReadiness } from '@/types/service-readiness';
import { formatBytes } from '@/utils/formatters';
import { ServiceJob, ServiceStatusNumber } from '@oceanprotocol/lib';
import styles from './service-startup-progress.module.css';

/** The last startup step, named for engines the node identifies (`readiness.engine`). */
const STARTING_LABELS: Record<string, string> = {
  comfyui: 'Starting ComfyUI',
};

/**
 * What the service is doing right now, in one line — for the page header, beside the status chip.
 *
 * The chip says the service is warming up; this says how far along it is. A bar is drawn only when
 * a real percentage exists (image pull always, model download when the size could be established);
 * otherwise the label carries it alone, because a bar with no scale invites the reader to guess at
 * a position that means nothing.
 *
 * Returns null once the engine answers, and for nodes that report no readiness at all.
 */
export function useStartupSummary(job: ServiceJob | null): { label: string; percent: number | null } | null {
  const readiness = getServiceReadiness(job);
  if (!job || !readiness || readiness.state === 'ready') {
    return null;
  }
  const pull = getImagePullProgress(job);
  const model = getModelDownload(job);
  const isRunning = job.status === ServiceStatusNumber.Running;

  if (!isRunning) {
    // Still getting the image onto the host. Docker's byte counts are exact, so this always has a
    // percentage — unless the image was already cached, in which case there is nothing to show.
    if (!pull || pull.phase === 'complete') {
      return { label: 'Preparing container', percent: null };
    }
    return { label: 'Downloading image', percent: pull.percent };
  }
  // A ComfyUI bundle lists its files up front, so it is done when every file is, and its count
  // rides along with the bytes.
  const filesTotal = model?.filesTotal;
  const downloading = model && (filesTotal !== undefined ? model.filesComplete < filesTotal : model.percent !== 100);
  if (downloading) {
    const label =
      filesTotal !== undefined ? `Downloading models (${model.filesComplete} of ${filesTotal})` : 'Downloading model';
    if (model.percent === undefined) {
      // Bytes but no denominator (a local path, or a repo the Hub has not indexed): say how much has
      // arrived rather than drawing a bar that cannot fill.
      return { label: `${label} · ${formatBytes(model.downloadedBytes)}`, percent: null };
    }
    return { label, percent: model.percent };
  }
  // Weights are in; the engine is starting up. Nothing reports progress for this.
  return { label: STARTING_LABELS[readiness.engine ?? ''] ?? 'Starting engine', percent: null };
}

/** The header readout: a sliver of a bar when there is a real percentage, plus its label. */
export const ServiceStartupIndicator: React.FC<{ job: ServiceJob | null; className?: string }> = ({
  job,
  className,
}) => {
  const summary = useStartupSummary(job);
  if (!summary) {
    return null;
  }
  return (
    <div className={className}>
      {summary.percent !== null && (
        <div
          aria-label={summary.label}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={summary.percent}
          className={styles.miniTrack}
          role="progressbar"
        >
          <div className={styles.miniFill} style={{ width: `${summary.percent}%` }} />
        </div>
      )}
      <span className={styles.miniValue}>
        {summary.percent !== null ? `${summary.label} ${summary.percent}%` : summary.label}
      </span>
    </div>
  );
};

export default ServiceStartupIndicator;
