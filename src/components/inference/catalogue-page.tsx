import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useLegacyViewRedirect from '@/components/hooks/use-legacy-view-redirect';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import CatalogueBrowser from '@/components/inference/catalogue-browser';
import { CatalogueConfig } from '@/components/inference/catalogue-config';
import { rememberCatalogueUrl } from '@/components/inference/details-page';
import InferenceStepper from '@/components/inference/inference-stepper';
import { trackTemplateOpened } from '@/components/inference/template-details-page';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { detailsPath } from '@/services/inference-url';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate } from '@/types/templates';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';

/**
 * Both catalogue pages: /inference/services (bare apps) and /inference/templates (the same apps with
 * models pre-loaded — `kind: 'bundle'` on the wire). Picking an entry opens its details page
 * (template-details-page), where it is reviewed and launched.
 *
 * The two pages differ only in which entries they list and what they're called, so that lives in
 * `catalogue-config.tsx` and everything else is shared: one catalogue is fetched from the node
 * (useServiceTemplates) and one browser renders it.
 */
const CataloguePage: React.FC<{ catalogue: CatalogueConfig }> = ({ catalogue }) => {
  const router = useRouter();
  const { clearSelection } = useInferenceContext();

  const { templates, loading, error } = useServiceTemplates();
  const entries = useMemo(() => catalogue.select(templates), [catalogue, templates]);
  // Unlisted entries are only hidden from the grid; their details page (and a legacy `?view=<id>` link,
  // which redirects there) still opens them. Sort is stable, so entries without an `order` keep the
  // node's order after the ordered ones.
  const listed = useMemo(
    () =>
      entries
        .filter((tpl) => !tpl.unlisted)
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)),
    [entries],
  );
  useLegacyViewRedirect(catalogue.pathname);

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetails = (tpl: AppTemplate) => {
    trackTemplateOpened(tpl, 'click');
    rememberCatalogueUrl(router.asPath);
    router.push(detailsPath(catalogue.pathname, tpl.id));
  };

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch an app on an Ocean Node"
        contentBetween={
          <InferenceStepper
            currentStep="template"
            flowType={InferenceFlowType.Template}
            kindLabel={catalogue.kindLabel}
          />
        }
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <CatalogueBrowser copy={catalogue} error={error} items={listed} loading={loading} onOpen={openDetails} />
        </Card>
      </div>
    </Container>
  );
};

export default CataloguePage;
