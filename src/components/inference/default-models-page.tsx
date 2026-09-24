import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useDefaultModelPackages from '@/components/hooks/use-default-model-packages';
import usePackageEnvs, { packageFloorSizing, ResolvedPackageEnv } from '@/components/hooks/use-package-env';
import usePackageModel from '@/components/hooks/use-package-model';
import { QuickStartPick } from '@/components/hooks/use-quick-start';
import useUrlSelection from '@/components/hooks/use-url-selection';
import InferenceStepper from '@/components/inference/inference-stepper';
import PackageCard from '@/components/inference/package-card';
import PackageDetailsModal from '@/components/inference/package-details-modal';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { InferenceOpenedVia, trackInferenceSelection } from '@/lib/inference-analytics';
import { encodeDeclaredResources } from '@/services/inference-url';
import { InferenceFlowType, InferencePackage } from '@/types/inference';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import styles from './default-models-page.module.css';

/**
 * Quick start: pick a curated package (model + engine preset), review it, press Start in the modal,
 * go straight to payment. The package carries a model stub (grid renders with no fetch); the full
 * model is fetched by id on pick. Envs are resolved live from the package's source node and filtered
 * to those that satisfy its resource floors, and the modal's quick start picks one of them (and its
 * fee token). "Advanced setup" hands the model/params to the custom-model flow for full control.
 */

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
  // Duration edited in the modal but stays local until a Continue/Customize — a pick commits nothing.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);

  // Always start fresh (new entry or Back-nav from payment): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackOpened = (pkg: InferencePackage, openedVia: InferenceOpenedVia) => {
    setDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
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

  // The package whose details are open, mirrored into `?view=` so the modal can be shared by link.
  const {
    selected: selectedPackage,
    open: openInUrl,
    close: closeDetails,
  } = useUrlSelection({
    items: packages,
    loaded: !loadingPackages && !packagesError,
    onOpenFromUrl: (pkg) => trackOpened(pkg, 'link'),
  });

  // Picking a package only opens its details — commits nothing until a Continue/Customize.
  const selectPackage = (pkg: InferencePackage) => {
    trackOpened(pkg, 'click');
    openInUrl(pkg);
  };

  const envs = usePackageEnvs(selectedPackage);
  const model = usePackageModel(selectedPackage);

  // Commit the picked bundle (model + params + duration + engine) to context and hand off. The query
  // is built from overrides so it doesn't depend on setState timing. `pick` is set only for the Start →
  // payment path; the advanced handoff commits no env (the custom flow starts at env-selection). A pick
  // carries the recommended CPU/RAM/disk it was priced on (recommendedSizing); the advanced handoff
  // carries the package's per-resource MIN as a floor under the custom flow's GPU-fraction slice
  // (packageFloorSizing, only where stricter than the env's own min, as the allocation hook takes
  // max(envMin, floor)). The handoff also carries the package's declared resources (`reqs`), which the
  // custom flow's env picker shows so a hand-picked env can be sized against them.
  const commitAndPush = (
    pathname: string,
    // What the quick start confirmed, when the commit came from it: the units it books, the node's own
    // freshly re-read environment and the sizing it was priced on. `pick.entry` carries the resolver's
    // older snapshot and the package's default units, so committing that instead would book a slice
    // the node may already have given away.
    pick?: QuickStartPick<ResolvedPackageEnv>
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
    const sizing = pick ? pick.sizing : packageFloorSizing(selectedPackage);
    if (pick) {
      setSelectedEnv({ ...pick.entry.env, environment: pick.environment, gpuSelection: pick.gpuSelection, sizing });
      setSelectedToken(pick.token);
    }
    const declaredResources = pick ? undefined : encodeDeclaredResources(selectedPackage.requiredResources);
    router.push({
      pathname,
      query: {
        ...buildSelectionQuery({
          models: [model],
          durationSeconds,
          engine: selectedPackage.params.engine,
          modelParamsByModel: { [model.id]: selectedPackage.params },
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
    if (selectedPackage) {
      commitAndPush(`/inference/default-models/${encodeURIComponent(selectedPackage.id)}/payment`, pick);
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
        onClose={closeDetails}
        onAdvanced={goToAdvancedFlow}
        onContinue={goToPayment}
      />
    </Container>
  );
};

export default DefaultModelsPage;
