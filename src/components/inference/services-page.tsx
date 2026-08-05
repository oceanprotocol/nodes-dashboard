import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import useTemplateEnvs, { ResolvedTemplateEnv } from '@/components/hooks/use-template-envs';
import CatalogueBrowser from '@/components/inference/catalogue-browser';
import InferenceStepper from '@/components/inference/inference-stepper';
import TemplateDetailsModal from '@/components/inference/template-details-modal';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { selectServices } from '@/services/service-templates';
import { templatePinnedSizing } from '@/services/template-launch';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate, requiredEnvVars } from '@/types/templates';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import styles from './catalogue.module.css';

/**
 * Services catalogue: pick a ready-made containerized app (ComfyUI, JupyterLab, …), review it in the
 * details modal, then launch straight onto one of the environments that can run it — or hand off to the
 * full env picker ("Advanced setup"). Browsing (filters, grid, states) is CatalogueBrowser, shared with
 * the templates catalogue. Templates are served by the node (getServiceTemplates); see
 * useServiceTemplates. Templates (the same apps with models pre-loaded — `kind: 'bundle'` on the wire)
 * are filtered out here; they have their own catalogue at /inference/templates.
 */
const ServicesPage: React.FC = () => {
  const router = useRouter();
  const {
    setSelectedTemplate,
    setSelectedEnv,
    setSelectedToken,
    setJobDurationSeconds,
    clearSelection,
    buildSelectionQuery,
  } = useInferenceContext();

  const { templates: catalogue, loading, error } = useServiceTemplates();
  // Templates live on their own page (/inference/templates) — one listed here too would appear twice.
  const templates = useMemo(() => selectServices(catalogue), [catalogue]);
  // The template whose details are open. Picking one commits nothing — only a Continue/Advanced does.
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
  };

  // Continue from an env card: commit template + env + token + duration, then go straight to payment.
  // The resources step is skipped (this modal already picked the env) and so is config — a fresh
  // template launch needs no env vars. The query is built from overrides so it doesn't depend on
  // setState timing, and carries the template's pinned CPU/RAM/disk so payment books that allocation.
  const continueToPayment = (entry: ResolvedTemplateEnv, token: SelectedToken, gpuSelection: GpuSelection) => {
    if (!openTemplate) {
      return;
    }
    const env = { ...entry.env, gpuSelection };
    setSelectedTemplate(openTemplate);
    setSelectedEnv(env);
    setSelectedToken(token);
    setJobDurationSeconds(durationSeconds);
    // A template that declares a required env var gets the config step first; otherwise straight to
    // payment (the modal already picked the env, so resources is skipped either way).
    const next = requiredEnvVars(openTemplate).length > 0 ? 'config' : 'payment';
    router.push({
      pathname: `/inference/services/${encodeURIComponent(openTemplate.id)}/${next}`,
      query: buildSelectionQuery({
        templateId: openTemplate.id,
        peerId: env.nodeInfo.id,
        envId: env.environment.id,
        gpuSelection,
        sizing: env.sizing ?? templatePinnedSizing(openTemplate),
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
          <InferenceStepper currentStep="template" flowType={InferenceFlowType.Template} kindLabel="Service" />
        }
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <CatalogueBrowser
            emptyCatalogue={<div className={cx(styles.stateBox, 'textSecondary')}>No services available.</div>}
            error={error}
            heading="Pick a service"
            items={templates}
            lead="Ready-made containerized apps — pick one, review what’s inside, choose an environment, pay and launch. Models are yours to add from the app once it’s running."
            loading={loading}
            noun="service"
            nounPlural="services"
            onOpen={openDetails}
            pathname="/inference/services"
            searchPlaceholder="Search services"
          />
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

export default ServicesPage;
