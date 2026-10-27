import {
  getImagePullProgress,
  getModelDownload,
  getServiceReadiness,
  ServiceModelDownload,
} from '@/types/service-readiness';
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
 * Returns null once the engine answers. A service the node cannot probe has no readiness, only its
 * launch script's download report: that shows while it runs, and the line goes away once it
 * completes, since nothing then says when the app itself is up.
 */
export function useStartupSummary(job: ServiceJob | null): StartupSummary | null {
  const readiness = getServiceReadiness(job);
  if (!job || readiness?.state === 'ready') {
    return null;
  }
  const pull = getImagePullProgress(job);
  const model = getModelDownload(job);
  const isRunning = job.status === ServiceStatusNumber.Running;

  if (!readiness) {
    return isRunning && model && isDownloading(model) ? downloadSummary(model) : null;
  }
  if (!isRunning) {
    // Still getting the image onto the host. Docker's byte counts are exact, so this always has a
    // percentage — unless the image was already cached, in which case there is nothing to show.
    if (!pull || pull.phase === 'complete') {
      return { label: 'Preparing container', percent: null };
    }
    return { label: 'Downloading image', percent: pull.percent };
  }
  if (model && isDownloading(model)) {
    return downloadSummary(model);
  }
  // Weights are in; the engine is starting up. Nothing reports progress for this.
  return { label: STARTING_LABELS[readiness.engine ?? ''] ?? 'Starting engine', percent: null };
}

type StartupSummary = { label: string; percent: number | null };

/** A download listed up front (a template's manifest) is done when every entry is. */
function isDownloading(model: ServiceModelDownload): boolean {
  return model.filesTotal !== undefined ? model.filesComplete < model.filesTotal : model.percent !== 100;
}

function downloadSummary(model: ServiceModelDownload): StartupSummary {
  const label =
    model.filesTotal !== undefined && model.filesTotal > 1
      ? `Downloading models (${model.filesComplete} of ${model.filesTotal})`
      : 'Downloading model';
  if (model.percent === undefined) {
    // Bytes but no denominator (a local path, or a repo the Hub has not indexed): say how much has
    // arrived rather than drawing a bar that cannot fill.
    return { label: `${label} · ${formatBytes(model.downloadedBytes)}`, percent: null };
  }
  return { label, percent: model.percent };
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
