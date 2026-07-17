import Card from '@/components/card/card';
import Container from '@/components/container/container';
import usePackageEnv from '@/components/hooks/use-package-env';
import InferenceStepper from '@/components/inference/inference-stepper';
import PackageCard from '@/components/inference/package-card';
import PackageDetailsModal from '@/components/inference/package-details-modal';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { fetchInferencePackages } from '@/mock/inference-packages';
import { InferenceFlowType, InferencePackage } from '@/types/inference';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import styles from './default-models-page.module.css';

/**
 * Quick start: pick a curated package (model + engine preset + pinned env), review it, go straight
 * to payment. Env is baked into the package and resolved live by id. "Advanced flow" hands the same
 * selection to the custom-model flow for full control.
 */
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
  };

  const env = usePackageEnv(selectedPackage);
  const { resolved } = env;

  // Commit the picked bundle to context and hand off. Env/token are pre-picked only when the pinned
  // env has resolved; the env query fields are carried on the same condition (else the custom flow
  // starts with none pre-picked). The query is built from overrides so it doesn't depend on the
  // setState timing. Callers gate on `resolved` themselves when the target step needs a live env.
  const commitAndPush = (pathname: string) => {
    if (!selectedPackage) {
      return;
    }
    setSelectedModels([selectedPackage.model]);
    setParamsForModel(selectedPackage.model.id, selectedPackage.params);
    setJobDurationSeconds(durationSeconds);
    if (resolved) {
      setSelectedEnv(resolved.env);
      setSelectedToken(resolved.token);
    }
    router.push({
      pathname,
      query: buildSelectionQuery({
        models: [selectedPackage.model],
        durationSeconds,
        modelParamsByModel: { [selectedPackage.model.id]: selectedPackage.params },
        ...(resolved
          ? {
              peerId: resolved.env.nodeInfo.id,
              envId: resolved.env.environment.id,
              gpuSelection: resolved.env.gpuSelection,
              tokenAddress: resolved.token.address,
            }
          : {}),
      }),
    });
  };

  const goToPayment = () => {
    // Payment needs the resolved env; the button is disabled until it resolves, but guard anyway.
    if (selectedPackage && resolved) {
      commitAndPush(`/inference/default-models/${encodeURIComponent(selectedPackage.id)}/payment`);
    }
  };

  // Advanced handoff: same selection, full control. Lands on the custom flow's env-selection step, so
  // unlike Continue/payment it does NOT need the pinned env to resolve — a failed pinned env still
  // lets the user escape into the custom flow.
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
        onClose={() => setSelectedPackage(null)}
        onCustomize={goToAdvancedFlow}
        onContinue={goToPayment}
      />
    </Container>
  );
};

export default DefaultModelsPage;
