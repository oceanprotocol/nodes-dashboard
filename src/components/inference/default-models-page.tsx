import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useDefaultModelPackages from '@/components/hooks/use-default-model-packages';
import { ResourceSizing } from '@/components/hooks/use-inference-allocation';
import usePackageEnvs, { ResolvedPackageEnv } from '@/components/hooks/use-package-env';
import usePackageModel from '@/components/hooks/use-package-model';
import InferenceStepper from '@/components/inference/inference-stepper';
import PackageCard from '@/components/inference/package-card';
import PackageDetailsModal from '@/components/inference/package-details-modal';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { InferenceFlowType, InferencePackage } from '@/types/inference';
import cx from 'classnames';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import styles from './default-models-page.module.css';

/**
 * Quick start: pick a curated package (model + engine preset), review it, pick one of the source
 * node's environments in the modal, go straight to payment. The package carries a model stub (grid
 * renders with no fetch); the full model is fetched by id on pick. Envs are resolved live from the
 * package's source node and filtered to those that satisfy its resource floors; the fee token is
 * picked per env card. "Advanced flow" hands the model/params to the custom-model flow for full control.
 */

// Advanced handoff floor: the package's per-resource MIN (cpu/ram/disk) becomes a lower bound on the
// custom flow's GPU-fraction-derived slice. Combined with the env's own min via max downstream in the
// allocation hook, so it only bites where the package minimum is stricter than the environment's.
function packageFloorSizing(pkg: InferencePackage): ResourceSizing {
  const min = (id: string) => pkg.requiredResources.find((r) => r.id === id)?.min ?? 0;
  return { mode: 'floor', cpu: min('cpu'), ram: min('ram'), disk: min('disk') };
}

const DefaultModelsPage: React.FC = () => {
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

  // Packages come from the configured nodes' advertised service templates (getServiceTemplates).
  const { packages, loading: loadingPackages, error: packagesError } = useDefaultModelPackages();
  const [selectedPackage, setSelectedPackage] = useState<InferencePackage | null>(null);
  // Duration edited in the modal but stays local until a Continue/Customize — a pick commits nothing.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);

  // Always start fresh (new entry or Back-nav from payment): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picking a package only opens its details — commits nothing until a Continue/Customize.
  const selectPackage = (pkg: InferencePackage) => {
    setSelectedPackage(pkg);
    setDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
    posthog.capture('inference_package_selected', {
      packageId: pkg.id,
      engine: pkg.params.engine,
      durationSeconds: DEFAULT_JOB_DURATION_SECONDS,
      branch: 'quickstart',
    });
  };

  const envs = usePackageEnvs(selectedPackage);
  const model = usePackageModel(selectedPackage);

  // Commit the picked bundle (model + params + duration + engine) to context and hand off. The query
  // is built from overrides so it doesn't depend on setState timing. `pickedEnv`/`token` are set only
  // for the Continue → payment path; the advanced handoff commits none (the custom flow starts at
  // env-selection). `sizing` differs by target: payment pins the package's recommended CPU/RAM/disk
  // (sizing.mode='pinned', carried on pickedEnv); the advanced handoff carries the package's per-resource
  // MIN as a floor under the custom flow's GPU-fraction slice (sizing.mode='floor', only where stricter
  // than the env's own min — the allocation hook takes max(envMin, floor)).
  const commitAndPush = (
    pathname: string,
    pickedEnv?: ResolvedPackageEnv,
    token?: SelectedToken
  ) => {
    if (!selectedPackage || !model) {
      return;
    }
    setSelectedModels([model]);
    setParamsForModel(model.id, selectedPackage.params);
    setJobDurationSeconds(durationSeconds);
    // Carry the package's engine into the flow so the Advanced handoff lands on the custom flow with
    // it preselected (still changeable), and payment launches on the right runtime.
    setEngine(selectedPackage.params.engine);
    if (pickedEnv) {
      setSelectedEnv(pickedEnv.env);
      setSelectedToken(token ?? pickedEnv.token);
    }
    const sizing = pickedEnv ? pickedEnv.env.sizing : packageFloorSizing(selectedPackage);
    router.push({
      pathname,
      query: buildSelectionQuery({
        models: [model],
        durationSeconds,
        engine: selectedPackage.params.engine,
        modelParamsByModel: { [model.id]: selectedPackage.params },
        ...(pickedEnv
          ? {
              peerId: pickedEnv.env.nodeInfo.id,
              envId: pickedEnv.env.environment.id,
              gpuSelection: pickedEnv.env.gpuSelection,
              sizing,
              ...(token ?? pickedEnv.token ? { tokenAddress: (token ?? pickedEnv.token)!.address } : {}),
            }
          : { sizing }),
      }),
    });
  };

  // Continue from a specific env card → straight to payment with that env + the card's fee token.
  const goToPayment = (pickedEnv: ResolvedPackageEnv, token: SelectedToken) => {
    if (selectedPackage) {
      commitAndPush(`/inference/default-models/${encodeURIComponent(selectedPackage.id)}/payment`, pickedEnv, token);
    }
  };

  // Advanced handoff: same model/params, full control. Lands on the custom flow's env-selection step,
  // so it commits no env — the user picks one there. Carries the package's per-resource min as a floor.
  const goToAdvancedFlow = () => commitAndPush('/inference/custom-models/resources');

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch a model on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="model" flowType={InferenceFlowType.DefaultModel} />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <h3>Pick a package</h3>
          <div>
            Model, environment and engine settings - preconfigured and ready to run. Select one, review what&apos;s
            inside, pay and launch.
          </div>
          {loadingPackages ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>Loading packages…</div>
          ) : packagesError ? (
            <div className={cx(styles.stateBox, 'textErrorDarker')}>{packagesError}</div>
          ) : packages.length === 0 ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>No packages available right now.</div>
          ) : (
            <div className={styles.grid}>
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} onToggle={selectPackage} pkg={pkg} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <PackageDetailsModal
        pkg={selectedPackage}
        envs={envs}
        durationSeconds={durationSeconds}
        onDurationChange={setDurationSeconds}
        onClose={() => setSelectedPackage(null)}
        onCustomize={goToAdvancedFlow}
        onContinue={goToPayment}
      />
    </Container>
  );
};

export default DefaultModelsPage;
