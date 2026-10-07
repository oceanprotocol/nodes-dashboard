import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useDefaultModelPackages from '@/components/hooks/use-default-model-packages';
import useLegacyViewRedirect from '@/components/hooks/use-legacy-view-redirect';
import { rememberCatalogueUrl } from '@/components/inference/details-page';
import InferenceStepper from '@/components/inference/inference-stepper';
import PackageCard from '@/components/inference/package-card';
import { trackPackageOpened } from '@/components/inference/package-details-page';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { detailsPath, INFERENCE_PATHS } from '@/services/inference-url';
import { InferenceFlowType, InferencePackage } from '@/types/inference';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import styles from './default-models-page.module.css';

/**
 * Quick start: pick a curated package (model + engine preset). Picking one opens its details page
 * (package-details-page), where it is reviewed and launched. The package carries a model stub, so the
 * grid renders with no fetch.
 */
const DefaultModelsPage: React.FC = () => {
  const router = useRouter();
  const { clearSelection } = useInferenceContext();

  // Packages come from the configured nodes' advertised service templates (getServiceTemplates).
  const { packages, loading: loadingPackages, error: packagesError } = useDefaultModelPackages();
  useLegacyViewRedirect(INFERENCE_PATHS.packages);

  // Always start fresh (new entry or Back-nav from payment): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetails = (pkg: InferencePackage) => {
    trackPackageOpened(pkg, 'click');
    rememberCatalogueUrl(router.asPath);
    router.push(detailsPath(INFERENCE_PATHS.packages, pkg.id));
  };

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
                <PackageCard key={pkg.id} onOpen={openDetails} pkg={pkg} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </Container>
  );
};

export default DefaultModelsPage;
