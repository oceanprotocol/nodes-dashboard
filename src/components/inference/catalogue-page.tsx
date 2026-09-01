import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import useTemplateEnvs, { ResolvedTemplateEnv } from '@/components/hooks/use-template-envs';
import CatalogueBrowser from '@/components/inference/catalogue-browser';
import { CatalogueConfig } from '@/components/inference/catalogue-config';
import InferenceStepper from '@/components/inference/inference-stepper';
import { templateHardware, templateVendor } from '@/components/inference/template-visual';
import TemplateDetailsModal from '@/components/inference/template-details-modal';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { resolveInferenceBranch } from '@/lib/inference-analytics';
import { templateFloorSizing, templateNeedsConfigStep } from '@/services/template-launch';
import { ComputeEnvironment } from '@/types/environments';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate, isBundle } from '@/types/templates';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useMemo, useState } from 'react';

/**
 * Both catalogue pages: /inference/services (bare apps) and /inference/templates (the same apps with
 * models pre-loaded — `kind: 'bundle'` on the wire). Pick an entry, review it in the details modal,
 * then launch straight onto one of the environments that can run it — or hand off to the full env
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
  // The entry whose details are open. Picking one commits nothing — only a Continue/Advanced does.
  const [openTemplate, setOpenTemplate] = useState<AppTemplate | null>(null);
  // Session length edited in the modal but kept local until a Continue/Advanced handoff.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templateEnvs = useTemplateEnvs(openTemplate);

  const openDetails = (tpl: AppTemplate) => {
    setOpenTemplate(tpl);
    setDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
    posthog.capture('inference_template_selected', {
      templateId: tpl.id,
      templateName: tpl.name ?? tpl.id,
      category: tpl.category,
      gpu: templateHardware(tpl).gpu,
      vendor: templateVendor(tpl.image),
      isBundle: isBundle(tpl),
      durationSeconds: DEFAULT_JOB_DURATION_SECONDS,
      branch: resolveInferenceBranch(InferenceFlowType.Template, tpl),
    });
  };

  /**
   * Continue from an env card: commit template + env + token + duration, then step forward. The
   * resources step is skipped (this modal already picked the env), and so is config unless the template
   * declares a required env var (without it the container starts and fails) or needs the bucket picker
   * (templateNeedsConfigStep — that pick must happen before the escrow claim). The query is built
   * from overrides so it doesn't depend on setState timing, and carries the template's pinned
   * CPU/RAM/disk so payment books that allocation (a bundle's disk floor covers its weights).
   */
  const continueToPayment = (
    entry: ResolvedTemplateEnv,
    token: SelectedToken,
    gpuSelection: GpuSelection,
    // The env the card priced and validated this pick against — the node's own, re-read at click time.
    // `entry.env.environment` is the resolver's older snapshot, so committing that carried a slice the
    // node may already have handed to someone else into payment and launch.
    environment: ComputeEnvironment
  ) => {
    if (!openTemplate) {
      return;
    }
    const env = { ...entry.env, gpuSelection, environment };
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
        sizing: env.sizing ?? templateFloorSizing(openTemplate),
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
        onClose={() => setOpenTemplate(null)}
        onContinue={continueToPayment}
        onDurationChange={setDurationSeconds}
        template={openTemplate}
      />
    </Container>
  );
};

export default CataloguePage;
