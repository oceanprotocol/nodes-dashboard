import Button from '@/components/button/button';
import usePackageEnv from '@/components/hooks/use-package-env';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import InferenceModelList, { ServiceModel } from '@/components/inference/inference-model-list';
import DurationInput from '@/components/input/duration-input';
import Modal from '@/components/modal/modal';
import { InferencePackage } from '@/types/inference';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration } from '@/utils/formatters';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { CircularProgress } from '@mui/material';
import cx from 'classnames';
import { useMemo } from 'react';
import styles from './package-details-modal.module.css';

interface PackageDetailsModalProps {
  pkg: InferencePackage | null;
  env: ReturnType<typeof usePackageEnv>;
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  onClose: () => void;
  onCustomize: () => void;
  onContinue: () => void;
}

/**
 * "What's included" details for a picked package: model & engine preset, runtime and the resolved
 * environment. Selection lives in the parent — closing this keeps the package selected.
 */
const PackageDetailsModal: React.FC<PackageDetailsModalProps> = ({
  pkg,
  env,
  durationSeconds,
  onDurationChange,
  onClose,
  onCustomize,
  onContinue,
}) => {
  const { resolved, loading: resolvingEnv, loadError: envError, retry } = env;
  const serviceModels: ServiceModel[] = useMemo(() => (pkg ? [{ model: pkg.model, params: pkg.params }] : []), [pkg]);

  // The picked env's paid service-on-demand window. The node sets expiresAt = now + duration and
  // sweeps a below-min job to Expired almost immediately, so the duration must stay inside these
  // bounds. Unset bounds fall back to 0 / Infinity. Same rule the custom flow enforces.
  const durationMin = resolved?.env.environment.minJobDuration ?? 0;
  const durationMax = resolved?.env.environment.maxJobDuration ?? Infinity;

  let durationError: string | undefined;
  if (resolved && durationSeconds < durationMin) {
    durationError = `This environment needs at least ${formatDuration(durationMin)}.`;
  } else if (resolved && durationSeconds > durationMax) {
    durationError = `This environment allows at most ${formatDuration(durationMax)}.`;
  }

  const renderNodeSection = () => {
    if (envError) {
      return (
        <div className={styles.stateBox}>
          <span className="textErrorDarker">{envError}</span>
          <Button color="accent2" onClick={retry} size="sm" variant="filled">
            Retry
          </Button>
        </div>
      );
    }
    if (resolvingEnv || !resolved) {
      return (
        <div className={cx(styles.stateBox, 'textSecondary')}>
          <CircularProgress size={16} />
          Loading the environment…
        </div>
      );
    }
    return (
      <InferenceEnvironmentCard
        durationSeconds={durationSeconds}
        environment={resolved.env.environment}
        gpuSelection={resolved.env.gpuSelection}
        nodeInfo={resolved.env.nodeInfo}
      />
    );
  };

  return (
    <Modal isOpen={!!pkg} onClose={onClose} title="What's included" width="md">
      {pkg && (
        <>
          <div>Everything below is included in the package.</div>

          <div className={styles.section}>
            <div>
              <h4>Model &amp; engine</h4>
              <div>Expand for the full launch preset</div>
            </div>
            <InferenceModelList models={serviceModels} />
          </div>

          <div className={styles.section}>
            <div>
              <h4>Runtime</h4>
              <div>You can prolong a running session later from its manage page.</div>
            </div>
            <div className={styles.durationRow}>
              <DurationInput
                availableUnits={DURATION_UNIT_OPTIONS}
                defaultUnit="hours"
                errorText={durationError}
                label="Session length"
                max={Number.isFinite(durationMax) ? durationMax : undefined}
                min={Math.max(1, durationMin)}
                onChange={onDurationChange}
                size="md"
                value={durationSeconds}
              />
            </div>
          </div>

          <div className={styles.section}>
            <h4>Environment</h4>
            {renderNodeSection()}
          </div>

          <div className="actionsGroupMdBetween">
            <Button color="accent1" onClick={onClose} variant="outlined">
              Close
            </Button>
            <div className="actionsGroupMdEnd">
              <Button
                color="accent1"
                contentBefore={<TuneOutlinedIcon />}
                disabled={!resolved || !!durationError}
                onClick={onCustomize}
                variant="outlined"
              >
                Customize
              </Button>
              <Button color="accent1" disabled={!resolved || !!durationError} onClick={onContinue}>
                Select &amp; continue
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};

export default PackageDetailsModal;
