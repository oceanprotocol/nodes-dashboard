import Button from '@/components/button/button';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import usePackageEnvs, { ResolvedPackageEnv } from '@/components/hooks/use-package-env';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import InferenceModelList, { ServiceModel } from '@/components/inference/inference-model-list';
import DurationInput from '@/components/input/duration-input';
import Modal from '@/components/modal/modal';
import { ComputeEnvironment } from '@/types/environments';
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
  envs: ReturnType<typeof usePackageEnvs>;
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  onClose: () => void;
  onCustomize: () => void;
  /** Continue from a specific env card → commit that env (with the card's fee token) + go to payment. */
  /**
   * `gpuSelection` and `environment` come from the card that priced this pick: the units it drew and
   * the node's own freshly re-read env. Both were dropped here, so the flow committed the resolver's
   * older snapshot and the package's default units instead of what was actually validated.
   */
  onContinue: (
    resolvedEnv: ResolvedPackageEnv,
    token: { address: string; symbol: string },
    gpuSelection: GpuSelection,
    environment: ComputeEnvironment
  ) => void;
}

/** Paid service-on-demand duration bounds for an env (0 / Infinity when unset). */
function durationBounds(environment: ComputeEnvironment): { min: number; max: number } {
  return { min: environment.minJobDuration ?? 0, max: environment.maxJobDuration ?? Infinity };
}

/**
 * "What's included" details for a picked package: model & engine preset, runtime, and the list of the
 * source node's environments that can run it (filtered to those satisfying the package's resource
 * floors). Each env is a read-only card with its own Continue → payment. Selection lives in the
 * parent — closing this keeps the package selected.
 */
const PackageDetailsModal: React.FC<PackageDetailsModalProps> = ({
  pkg,
  envs,
  durationSeconds,
  onDurationChange,
  onClose,
  onCustomize,
  onContinue,
}) => {
  const { resolved, loading: resolvingEnvs, loadError: envError, retry } = envs;
  const serviceModels: ServiceModel[] = useMemo(() => (pkg ? [{ model: pkg.model, params: pkg.params }] : []), [pkg]);
  const engineLabel = pkg?.params.engine === 'llamacpp' ? 'llama.cpp' : 'vLLM';

  // The shared duration must land inside EVERY env's own window — validated per card so a card whose
  // env can't fit the current duration disables its Continue (with a reason). Same rule as the custom flow.
  const durationErrorFor = (environment: ComputeEnvironment): string | undefined => {
    const { min, max } = durationBounds(environment);
    if (durationSeconds < min) {
      return `This environment needs at least ${formatDuration(min)}.`;
    }
    if (durationSeconds > max) {
      return `This environment allows at most ${formatDuration(max)}.`;
    }
    return undefined;
  };

  const renderEnvsSection = () => {
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
    if (resolvingEnvs) {
      return (
        <div className={cx(styles.stateBox, 'textSecondary')}>
          <CircularProgress size={16} />
          Loading environments…
        </div>
      );
    }
    if (resolved.length === 0) {
      return (
        <div className={cx(styles.stateBox, 'textSecondary')}>No environment available for this package right now.</div>
      );
    }
    return (
      <div className={styles.envList}>
        {/* Controlled gpuSelection → static chips (read-only, auto recommended). onSelect drives its
            own play/price button; disabledReason force-disables it (with a tooltip reason) when the
            shared duration is out of this env's bounds. */}
        {resolved.map((entry) => (
          <InferenceEnvironmentCard
            disabledReason={durationErrorFor(entry.env.environment)}
            durationSeconds={durationSeconds}
            environment={entry.env.environment}
            gpuSelection={entry.env.gpuSelection}
            key={entry.env.environment.id}
            nodeInfo={entry.env.nodeInfo}
            onSelect={(address, symbol, gpuSelection, environment) =>
              onContinue(entry, { address, symbol }, gpuSelection, environment)
            }
            sizing={entry.env.sizing}
          />
        ))}
      </div>
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
              <div>
                Runs on <strong>{engineLabel}</strong>. Expand for the full launch preset.
              </div>
            </div>
            <InferenceModelList models={serviceModels} />
          </div>

          <div className={styles.section}>
            <div>
              <h4>Runtime</h4>
              <div>
                You can prolong a running session later from its manage page.
                <br />
                Prices below are shown for this <strong>selected duration</strong>
              </div>
            </div>
            <div className={styles.durationRow}>
              <DurationInput
                availableUnits={DURATION_UNIT_OPTIONS}
                defaultUnit="hours"
                label="Session length"
                min={1}
                onChange={onDurationChange}
                size="sm"
                value={durationSeconds}
              />
            </div>
          </div>

          <div className={styles.section}>
            <div>
              <h4>Environment</h4>
              <div>Pick an environment to launch on. Continue takes you straight to payment.</div>
            </div>
            {renderEnvsSection()}
          </div>

          <div className="actionsGroupMdBetween">
            <Button color="accent1" onClick={onClose} variant="outlined">
              Close
            </Button>
            <Button color="accent1" contentBefore={<TuneOutlinedIcon />} onClick={onCustomize} variant="outlined">
              Customize
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default PackageDetailsModal;
