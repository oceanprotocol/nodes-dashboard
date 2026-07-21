import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { ResourceFloor } from '@/components/hooks/use-inference-allocation';
import usePackageEnv from '@/components/hooks/use-package-env';
import usePackageModel from '@/components/hooks/use-package-model';
import InferenceStepper from '@/components/inference/inference-stepper';
import PackageCard from '@/components/inference/package-card';
import PackageDetailsModal from '@/components/inference/package-details-modal';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { fetchInferencePackages } from '@/mock/inference-packages';
import { InferenceFlowType, InferencePackage } from '@/types/inference';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import styles from './default-models-page.module.css';

/**
 * Quick start: pick a curated package (model + engine preset + pinned env), review it, go straight to
 * payment. The package carries a model stub (grid renders with no fetch); the full model is fetched by
 * id on pick. Env resolved live by id; fee token picked in the modal. "Advanced flow" hands the same
 * selection to the custom-model flow for full control.
 */

// Advanced handoff floors: the package's per-resource MIN (cpu/ram/disk) becomes a lower bound on the
// custom flow's GPU-fraction-derived slice. Combined with the env's own min via max downstream in the
// allocation hook, so it only bites where the package minimum is stricter than the environment's.
function packageResourceFloor(pkg: InferencePackage): ResourceFloor {
  const min = (id: string) => pkg.requiredResources.find((r) => r.id === id)?.min ?? 0;
  return { cpu: min('cpu'), ram: min('ram'), disk: min('disk') };
}

const DefaultModelsPage: React.FC = () => {
  const router = useRouter();
  const {
    setSelectedModels,
    setParamsForModel,
    setSelectedEnv,
    setSelectedToken,
    setJobDurationSeconds,
    clearSelection,
    buildSelectionQuery,
  } = useInferenceContext();

  const [packages, setPackages] = useState<InferencePackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<InferencePackage | null>(null);
  // Duration edited in the modal but stays local until Continue/Customize — a pick commits nothing.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);
  // Token chosen in the modal's env card; overrides the env's seeded default. Resets on each pick.
  const [pickedToken, setPickedToken] = useState<SelectedToken | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInferencePackages().then((data) => {
      if (!cancelled) {
        setPackages(data);
        setLoadingPackages(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Always start fresh (new entry or Back-nav from payment): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picking a package only opens its details — commits nothing until Continue/Customize.
  const selectPackage = (pkg: InferencePackage) => {
    setSelectedPackage(pkg);
    setDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
    setPickedToken(null);
  };

  // Card refires onTokenChange on every settle; ignore no-op repeats to avoid a re-render loop.
  const handleTokenChange = useCallback((address: string, symbol: string) => {
    setPickedToken((prev) => (prev?.address === address && prev.symbol === symbol ? prev : { address, symbol }));
  }, []);

  const env = usePackageEnv(selectedPackage);
  const { resolved } = env;
  const model = usePackageModel(selectedPackage);
  // Modal pick wins, else the env's seeded default.
  const tokenToCommit = pickedToken ?? resolved?.token ?? null;

  // Commit the picked bundle to context and hand off. Env/token are pre-picked only when the pinned
  // env has resolved; the env query fields are carried on the same condition (else the custom flow
  // starts with none pre-picked). The query is built from overrides so it doesn't depend on the
  // setState timing. Callers gate on `resolved` themselves when the target step needs a live env.
  // `pinResources`: quick start pins the package's recommended CPU/RAM/disk into the URL/context so
  // payment books them. The advanced handoff omits the pin — the custom flow lets the user size
  // resources via the GPU picker — but instead carries the package's per-resource MIN as a `resourceFloor`
  // so the fraction-derived slice can't drop below the package minimum (only where it's stricter than
  // the env's own min; the allocation hook takes max(envMin, floor)).
  const commitAndPush = (pathname: string, pinResources: boolean) => {
    if (!selectedPackage || !model) {
      return;
    }
    setSelectedModels([model]);
    setParamsForModel(model.id, selectedPackage.params);
    setJobDurationSeconds(durationSeconds);
    if (resolved) {
      setSelectedEnv(
        pinResources
          ? resolved.env
          : { ...resolved.env, pinnedAllocation: undefined, resourceFloor: packageResourceFloor(selectedPackage) }
      );
      setSelectedToken(tokenToCommit);
    }
    router.push({
      pathname,
      query: buildSelectionQuery({
        models: [model],
        durationSeconds,
        modelParamsByModel: { [model.id]: selectedPackage.params },
        ...(resolved
          ? {
              peerId: resolved.env.nodeInfo.id,
              envId: resolved.env.environment.id,
              gpuSelection: resolved.env.gpuSelection,
              ...(pinResources
                ? { pinnedAllocation: resolved.env.pinnedAllocation }
                : { resourceFloor: packageResourceFloor(selectedPackage) }),
              ...(tokenToCommit ? { tokenAddress: tokenToCommit.address } : {}),
            }
          : {}),
      }),
    });
  };

  const goToPayment = () => {
    // Payment needs the resolved env; the button is disabled until it resolves, but guard anyway.
    if (selectedPackage && resolved) {
      commitAndPush(`/inference/default-models/${encodeURIComponent(selectedPackage.id)}/payment`, true);
    }
  };

  // Advanced handoff: same selection, full control. Lands on the custom flow's env-selection step, so
  // unlike Continue/payment it does NOT need the pinned env to resolve — a failed pinned env still
  // lets the user escape into the custom flow.
  const goToAdvancedFlow = () => commitAndPush('/inference/custom-models/resources', false);

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
        env={env}
        durationSeconds={durationSeconds}
        onDurationChange={setDurationSeconds}
        onTokenChange={handleTokenChange}
        onClose={() => setSelectedPackage(null)}
        onCustomize={goToAdvancedFlow}
        onContinue={goToPayment}
      />
    </Container>
  );
};

export default DefaultModelsPage;
