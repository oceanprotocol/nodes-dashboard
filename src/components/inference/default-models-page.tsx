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
 * Quick start: pick a curated package (model + engine preset + a pinned environment), review
 * what's inside, then go straight to payment. The environment is baked into the package and
 * resolved live by id — so the only decisions left are the package and how long it runs.
 * "Advanced flow" hands the same selection to the custom-model flow for full control.
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
  // Duration is edited in the details modal but stays local until Continue/Customize — nothing is
  // committed to the shared flow context on a mere pick. Seeded from the default on open.
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

  // This page always starts fresh: no package is preselected, whether entering new or via Back-nav
  // from payment. Clear any leftover selection context from a prior run once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picking a package only opens its details — nothing is committed to the shared flow context until
  // the user confirms with Continue/Customize. (Clicking the open package again just keeps it open.)
  const selectPackage = (pkg: InferencePackage) => {
    setSelectedPackage(pkg);
    setDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
  };

  const env = usePackageEnv(selectedPackage);
  const { resolved } = env;

  // Commit the picked bundle to the shared flow context and hand it off. Runs only on Continue/
  // Customize — the downstream pages read the committed context, and the query below carries the
  // same selection in the URL (built from overrides so it doesn't depend on the setState timing).
  const goTo = (pathname: string) => {
    if (!selectedPackage || !resolved) {
      return;
    }
    setSelectedModels([selectedPackage.model]);
    setParamsForModel(selectedPackage.model.id, selectedPackage.params);
    setJobDurationSeconds(durationSeconds);
    setSelectedEnv(resolved.env);
    setSelectedToken(resolved.token);
    router.push({
      pathname,
      query: buildSelectionQuery({
        models: [selectedPackage.model],
        peerId: resolved.env.nodeInfo.id,
        envId: resolved.env.environment.id,
        gpuSelection: resolved.env.gpuSelection,
        tokenAddress: resolved.token.address,
        durationSeconds,
        modelParamsByModel: { [selectedPackage.model.id]: selectedPackage.params },
      }),
    });
  };

  const goToPayment = () => {
    // Payment needs the resolved env; the button is disabled until it resolves, but guard anyway.
    if (selectedPackage && resolved) {
      goTo(`/inference/default-models/${encodeURIComponent(selectedPackage.id)}/payment`);
    }
  };

  // Advanced handoff: same selection, full control. Lands on the env step of the custom flow with
  // the package's model preselected, its params committed (config prefills from them) and — once
  // the env has resolved — that env pre-picked, so "Skip" continues with the package's env.
  const goToAdvancedFlow = () => goTo('/inference/custom-models/resources');

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
