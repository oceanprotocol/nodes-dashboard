import useDefaultModelPackages from '@/components/hooks/use-default-model-packages';
import usePackageEnvs, { packageFloorSizing, ResolvedPackageEnv } from '@/components/hooks/use-package-env';
import usePackageModel from '@/components/hooks/use-package-model';
import useQuickStart, { QuickStartPick } from '@/components/hooks/use-quick-start';
import {
  DetailsChip,
  DetailsHeader,
  DetailsLayout,
  DetailsMissing,
  DetailsPage,
  DetailsSection,
  DetailsSkeleton,
  DetailsTile,
} from '@/components/inference/details-page';
import InferenceModelList, { ServiceModel } from '@/components/inference/inference-model-list';
import InferenceStepper from '@/components/inference/inference-stepper';
import QuickStartBanner from '@/components/inference/quick-start-banner';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { InferenceOpenedVia, trackInferenceSelection } from '@/lib/inference-analytics';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { detailsPath, encodeDeclaredResources, firstQueryValue, INFERENCE_PATHS } from '@/services/inference-url';
import { declaredGpuRange } from '@/services/quick-start';
import { InferenceFlowType, InferencePackage } from '@/types/inference';
import { formatPipelineTag } from '@/utils/formatters';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

/**
 * A catalogue pick, sent as `inference_package_selected`. The card click reports `click` before
 * navigating here, and this page reports `link` once the package resolves, which trackInferenceSelection
 * drops when the click already counted it (see there).
 */
export const trackPackageOpened = (pkg: InferencePackage, openedVia: InferenceOpenedVia) => {
  trackInferenceSelection({
    event: 'inference_package_selected',
    branch: 'quickstart',
    itemId: pkg.id,
    openedVia,
    properties: {
      packageId: pkg.id,
      engine: pkg.params.engine,
      durationSeconds: DEFAULT_JOB_DURATION_SECONDS,
    },
  });
};

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
 * The details page of one curated package (model + engine preset), /inference/default-models/[modelId],
 * laid out like the template page (see details-page.tsx): the model as the header, the quick start
 * banner that picks one of the source nodes' environments by itself (see useQuickStart), then the
 * launch preset. The package carries a model stub (renders with no fetch); the full model is fetched
 * by id. Start goes straight to payment; Advanced setup hands the model and its preset to the custom
 * flow for anyone who wants to choose the environment or resources. Viewing commits nothing.
 */
const PackageDetailsPage: React.FC = () => {
  const router = useRouter();
  const {
    setSelectedModels,
    setParamsForModel,
    setSelectedEnv,
    setSelectedToken,
    setJobDurationSeconds,
    setEngine,
    clearSelection,
    buildSelectionQuery,
  } = useInferenceContext();

  // `[modelId]` names the package, not the model: packages come from the configured nodes' advertised
  // service templates (getServiceTemplates), and a package id is what the payment step's path carries too.
  const packageId = firstQueryValue(router.query.modelId);
  const { packages, loading, error } = useDefaultModelPackages();
  const pkg = useMemo(() => packages.find((p) => p.id === packageId) ?? null, [packages, packageId]);

  // Always start fresh (new entry or Back-nav from payment): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pkg) {
      trackPackageOpened(pkg, 'link');
    }
  }, [pkg]);

  // Session length, kept local until a Start/Advanced handoff.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);
  const { resolved, loading: envsLoading, loadError, retry } = usePackageEnvs(pkg);
  const model = usePackageModel(pkg);
  const serviceModels: ServiceModel[] = useMemo(() => (pkg ? [{ model: pkg.model, params: pkg.params }] : []), [pkg]);
  const engineLabel = pkg?.params.engine === 'llamacpp' ? 'llama.cpp' : 'vLLM';

  // Commit the package (model + params + duration + engine) to context and hand off. The query is built
  // from overrides so it doesn't depend on setState timing. `pick` is set only for the Start → payment
  // path; the advanced handoff commits no env (the custom flow starts at env-selection). A pick carries
  // the recommended CPU/RAM/disk it was priced on (recommendedSizing); the advanced handoff carries the
  // package's per-resource MIN as a floor under the custom flow's GPU-fraction slice (packageFloorSizing,
  // only where stricter than the env's own min, as the allocation hook takes max(envMin, floor)). The
  // handoff also carries the package's declared resources (`reqs`), which the custom flow's env picker
  // shows so a hand-picked env can be sized against them.
  const commitAndPush = (
    pathname: string,
    // What the quick start confirmed, when the commit came from it: the units it books, the node's own
    // freshly re-read environment and the sizing it was priced on. `pick.entry` carries the resolver's
    // older snapshot and the package's default units, so committing that instead would book a slice
    // the node may already have given away.
    pick?: QuickStartPick<ResolvedPackageEnv>
  ) => {
    if (!pkg || !model) {
      return;
    }
    setSelectedModels([model]);
    setParamsForModel(model.id, pkg.params);
    setJobDurationSeconds(durationSeconds);
    // Carry the package's engine into the flow so the Advanced handoff lands on the custom flow with
    // it preselected (still changeable), and payment launches on the right runtime.
    setEngine(pkg.params.engine);
    const sizing = pick ? pick.sizing : packageFloorSizing(pkg);
    if (pick) {
      setSelectedEnv({ ...pick.entry.env, environment: pick.environment, gpuSelection: pick.gpuSelection, sizing });
      setSelectedToken(pick.token);
    }
    const declaredResources = pick ? undefined : encodeDeclaredResources(pkg.requiredResources);
    router.push({
      pathname,
      query: {
        ...buildSelectionQuery({
          models: [model],
          durationSeconds,
          engine: pkg.params.engine,
          modelParamsByModel: { [model.id]: pkg.params },
          ...(pick
            ? {
                peerId: pick.entry.env.nodeInfo.id,
                envId: pick.environment.id,
                gpuSelection: pick.gpuSelection,
                sizing,
                tokenAddress: pick.token.address,
              }
            : { sizing }),
        }),
        ...(declaredResources ? { reqs: declaredResources } : {}),
      },
    });
  };

  // Quick start confirmed a pick → straight to payment with that env + its fee token.
  const goToPayment = (pick: QuickStartPick<ResolvedPackageEnv>) => {
    if (pkg) {
      commitAndPush(`${detailsPath(INFERENCE_PATHS.packages, pkg.id)}/payment`, pick);
    }
  };

  // Advanced handoff: same model/params, full control. Lands on the custom flow's env-selection step,
  // so it commits no env — the user picks one there. Carries the package's per-resource min as a floor.
  const goToAdvancedFlow = () => commitAndPush('/inference/custom-models/resources');

  // A package states its GPU count as both min and recommended today, so this rarely scales; the
  // range still lets a package that declares one fall back instead of failing.
  const gpuRange = useMemo(() => (pkg ? declaredGpuRange(pkg.requiredResources) : null), [pkg]);

  const quickStart = useQuickStart({
    entries: resolved,
    loading: envsLoading,
    loadError,
    retry,
    gpuRange,
    // Packages never launch without a GPU (the model has to fit in VRAM), whatever the env allows.
    allowZeroGpu: false,
    durationSeconds,
    onStart: goToPayment,
  });

  const browse = { href: INFERENCE_PATHS.packages, label: 'Browse packages' };

  const renderBody = () => {
    if (!router.isReady || (loading && !pkg)) {
      return <DetailsSkeleton />;
    }
    if (!pkg) {
      return error ? (
        <DetailsMissing action={browse} title="Couldn't load packages">
          {error}
        </DetailsMissing>
      ) : (
        <DetailsMissing action={browse} title="This package isn't available">
          None of the configured nodes list &ldquo;{packageId}&rdquo; right now. It may have been renamed or withdrawn.
        </DetailsMissing>
      );
    }
    return (
      <DetailsLayout
        back={{ pathname: INFERENCE_PATHS.packages, label: 'Back to packages' }}
        header={
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
            subtitle={pkg.description}
          />
        }
        launch={
          <QuickStartBanner
            durationSeconds={durationSeconds}
            onAdvanced={goToAdvancedFlow}
            onDurationChange={setDurationSeconds}
            quickStart={quickStart}
          />
        }
      >
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
      </DetailsLayout>
    );
  };

  return (
    <DetailsPage
      stepper={<InferenceStepper currentStep="model" flowType={InferenceFlowType.DefaultModel} />}
      subTitle="Launch a model on an Ocean Node"
    >
      {renderBody()}
    </DetailsPage>
  );
};

export default PackageDetailsPage;
