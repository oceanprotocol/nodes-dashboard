import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { QuickStartPick } from '@/components/hooks/use-quick-start';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import useTemplateEnvs, { ResolvedTemplateEnv } from '@/components/hooks/use-template-envs';
import useUrlSelection from '@/components/hooks/use-url-selection';
import CatalogueBrowser from '@/components/inference/catalogue-browser';
import { CatalogueConfig } from '@/components/inference/catalogue-config';
import InferenceStepper from '@/components/inference/inference-stepper';
import TemplateDetailsModal from '@/components/inference/template-details-modal';
import { templateHardware, templateVendor } from '@/components/inference/template-visual';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { InferenceOpenedVia, resolveInferenceBranch, trackInferenceSelection } from '@/lib/inference-analytics';
import { templateNeedsConfigStep } from '@/services/template-launch';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate, isBundle } from '@/types/templates';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

/**
 * Both catalogue pages: /inference/services (bare apps) and /inference/templates (the same apps with
 * models pre-loaded — `kind: 'bundle'` on the wire). Pick an entry, review it in the details modal,
 * then Start it on the environment the modal's quick start picks — or hand off to the full env
 * picker ("Advanced setup").
 *
 * The two pages differ only in which entries they list and what they're called, so that lives in
 * `catalogue-config.tsx` and everything else is shared: one catalogue is fetched from the node
 * (useServiceTemplates), one browser renders it, and one launch path serves both — a bundle is a
 * template on the wire, so the wizard is `/inference/services/[templateId]/…` either way.
 */
const CataloguePage: React.FC<{ catalogue: CatalogueConfig }> = ({ catalogue }) => {
  const router = useRouter();
  const {
    setSelectedTemplate,
    setSelectedEnv,
    setSelectedToken,
    setJobDurationSeconds,
    clearSelection,
    buildSelectionQuery,
  } = useInferenceContext();

  const { templates, loading, error } = useServiceTemplates();
  const entries = useMemo(() => catalogue.select(templates), [catalogue, templates]);

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session length edited in the modal but kept local until a Continue/Advanced handoff.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);

  const trackOpened = (tpl: AppTemplate, openedVia: InferenceOpenedVia) => {
    setDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
    trackInferenceSelection({
      event: 'inference_template_selected',
      branch: resolveInferenceBranch(InferenceFlowType.Template, tpl),
      itemId: tpl.id,
      openedVia,
      properties: {
        templateId: tpl.id,
        templateName: tpl.name ?? tpl.id,
        category: tpl.category,
        gpu: templateHardware(tpl).gpu,
        vendor: templateVendor(tpl.image),
        isBundle: isBundle(tpl),
        durationSeconds: DEFAULT_JOB_DURATION_SECONDS,
      },
    });
  };

  // The entry whose details are open, mirrored into `?view=` so the modal can be shared by link. Picking one commits nothing — only a Continue/Advanced does.
  const {
    selected: openTemplate,
    open: openInUrl,
    close: closeDetails,
  } = useUrlSelection({
    items: entries,
    loaded: !loading && !error,
    onOpenFromUrl: (tpl) => trackOpened(tpl, 'link'),
  });

  const templateEnvs = useTemplateEnvs(openTemplate);

  const openDetails = (tpl: AppTemplate) => {
    trackOpened(tpl, 'click');
    openInUrl(tpl);
  };

  /**
   * Quick start confirmed a pick: commit template + env + token + duration, then step forward. The
   * resources step is skipped (the modal already picked the env), and so is config unless the template
   * declares a required env var (without it the container starts and fails) or needs the bucket picker
   * (templateNeedsConfigStep — that pick must happen before the escrow claim). The query is built
   * from overrides so it doesn't depend on setState timing, and carries the CPU/RAM/disk the pick was
   * priced on so payment books that allocation (a bundle's disk floor covers its weights).
   */
  const continueToPayment = ({
    entry,
    token,
    gpuSelection,
    // The env the quick start confirmed this pick against — the node's own, re-read at click time.
    // `entry.env.environment` is the resolver's older snapshot, so committing that carried a slice the
    // node may already have handed to someone else into payment and launch.
    environment,
    // The CPU/RAM/disk the pick was priced on: the template's recommended amounts, scaled to its GPUs.
    sizing,
  }: QuickStartPick<ResolvedTemplateEnv>) => {
    if (!openTemplate) {
      return;
    }
    const env = { ...entry.env, gpuSelection, environment, sizing };
    setSelectedTemplate(openTemplate);
    setSelectedEnv(env);
    setSelectedToken(token);
    setJobDurationSeconds(durationSeconds);
    const next = templateNeedsConfigStep(openTemplate) ? 'config' : 'payment';
    router.push({
      pathname: `/inference/services/${encodeURIComponent(openTemplate.id)}/${next}`,
      query: buildSelectionQuery({
        templateId: openTemplate.id,
        peerId: env.nodeInfo.id,
        envId: env.environment.id,
        gpuSelection,
        sizing: env.sizing,
        tokenAddress: token.address,
        durationSeconds,
      }),
    });
  };

  // Advanced handoff: same template, full control. Lands on the resources step's env picker, so it
  // commits no env — the user picks one there.
  const goToAdvanced = () => {
    if (!openTemplate) {
      return;
    }
    setSelectedTemplate(openTemplate);
    setJobDurationSeconds(durationSeconds);
    router.push({
      pathname: `/inference/services/${encodeURIComponent(openTemplate.id)}/resources`,
      query: buildSelectionQuery({ templateId: openTemplate.id, durationSeconds }),
    });
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
          <CatalogueBrowser copy={catalogue} error={error} items={entries} loading={loading} onOpen={openDetails} />
        </Card>
      </div>

      <TemplateDetailsModal
        durationSeconds={durationSeconds}
        envs={templateEnvs}
        onAdvanced={goToAdvanced}
        onClose={closeDetails}
        onContinue={continueToPayment}
        onDurationChange={setDurationSeconds}
        template={openTemplate}
      />
    </Container>
  );
};

export default CataloguePage;
