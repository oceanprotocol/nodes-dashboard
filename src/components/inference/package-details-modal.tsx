import usePackageEnvs, { ResolvedPackageEnv } from '@/components/hooks/use-package-env';
import useQuickStart, { QuickStartPick } from '@/components/hooks/use-quick-start';
import {
  DetailsActions,
  DetailsChip,
  DetailsHeader,
  DetailsSection,
  DetailsTile,
} from '@/components/inference/details-modal';
import InferenceModelList, { ServiceModel } from '@/components/inference/inference-model-list';
import QuickStartBanner from '@/components/inference/quick-start-banner';
import Modal from '@/components/modal/modal';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { declaredGpuRange } from '@/services/quick-start';
import { InferencePackage } from '@/types/inference';
import { formatPipelineTag } from '@/utils/formatters';
import { useMemo, useState } from 'react';

interface PackageDetailsModalProps {
  pkg: InferencePackage | null;
  envs: ReturnType<typeof usePackageEnvs>;
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  onClose: () => void;
  /** Advanced setup: hand the model and its preset to the custom flow, where the env is picked by hand. */
  onAdvanced: () => void;
  /**
   * Quick start confirmed a pick: commit that env (with its fee token) and go to payment.
   * `gpuSelection`, `environment` and `sizing` are what the pick was confirmed against: the units it
   * books, the node's own freshly re-read env and the CPU/RAM/disk it was priced on. The entry carries
   * the resolver's older snapshot and the package's default units, so committing those instead would
   * book what wasn't checked.
   */
  onContinue: (pick: QuickStartPick<ResolvedPackageEnv>) => void;
}

/** The model's avatar in the header tile, falling back to its author's initial. */
const PackageMark: React.FC<{ pkg: InferencePackage }> = ({ pkg }) => {
  const [failed, setFailed] = useState(false);
  const avatarUrl = getModelAvatarUrl(pkg.model);
  if (avatarUrl && !failed) {
    return (
      <DetailsTile image>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" onError={() => setFailed(true)} src={avatarUrl} />
      </DetailsTile>
    );
  }
  return <DetailsTile>{(pkg.model.author ?? pkg.model.id).charAt(0).toUpperCase()}</DetailsTile>;
};

/**
 * "What's included" details for a picked package, laid out like the template modal (see
 * details-modal.tsx): the model as the header, the quick start banner that picks one of the source
 * nodes' environments by itself (see useQuickStart), then the launch preset. Advanced setup hands the
 * model to the custom flow for anyone who wants to choose the environment or resources. Selection
 * lives in the parent, and closing this keeps the package selected.
 */
const PackageDetailsModal: React.FC<PackageDetailsModalProps> = ({
  pkg,
  envs,
  durationSeconds,
  onDurationChange,
  onClose,
  onAdvanced,
  onContinue,
}) => {
  const { resolved, loading, loadError, retry } = envs;
  const serviceModels: ServiceModel[] = useMemo(() => (pkg ? [{ model: pkg.model, params: pkg.params }] : []), [pkg]);
  const engineLabel = pkg?.params.engine === 'llamacpp' ? 'llama.cpp' : 'vLLM';

  // A package states its GPU count as both min and recommended today, so this rarely scales; the
  // range still lets a package that declares one fall back instead of failing.
  const gpuRange = useMemo(() => (pkg ? declaredGpuRange(pkg.requiredResources) : null), [pkg]);

  const quickStart = useQuickStart({
    entries: resolved,
    loading,
    loadError,
    retry,
    gpuRange,
    // Packages never launch without a GPU (the model has to fit in VRAM), whatever the env allows.
    allowZeroGpu: false,
    durationSeconds,
    onStart: onContinue,
  });

  return (
    <Modal isOpen={!!pkg} onClose={onClose} title="What's included" width="md">
      {pkg && (
        <>
          <DetailsHeader
            chips={
              <>
                <DetailsChip tone="accent">{formatPipelineTag(pkg.model.pipelineTag, 'Model')}</DetailsChip>
                <DetailsChip>{engineLabel}</DetailsChip>
              </>
            }
            mark={<PackageMark pkg={pkg} />}
            meta={pkg.model.id}
            name={getModelShortName(pkg.model.id)}
          />

          <QuickStartBanner
            durationSeconds={durationSeconds}
            onAdvanced={onAdvanced}
            onDurationChange={onDurationChange}
            quickStart={quickStart}
          />

          <DetailsSection
            hint={
              <>
                Runs on <strong>{engineLabel}</strong>. Expand for the full launch preset.
              </>
            }
            title="Model & engine"
          >
            <InferenceModelList models={serviceModels} />
          </DetailsSection>

          <DetailsActions
            durationSeconds={durationSeconds}
            onAdvanced={onAdvanced}
            onClose={onClose}
            quickStart={quickStart}
          />
        </>
      )}
    </Modal>
  );
};

export default PackageDetailsModal;
