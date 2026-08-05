import Button from '@/components/button/button';
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
import { selectBundles } from '@/services/service-templates';
import { templatePinnedSizing } from '@/services/template-launch';
import { InferenceFlowType } from '@/types/inference';
import { AppBundle, AppTemplate, requiredEnvVars } from '@/types/templates';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import styles from './catalogue.module.css';

/**
 * Templates catalogue: a template is a service whose `command` pre-downloads a curated model set, so
 * it is usable the moment it opens. Same browsing as the services catalogue — same CatalogueBrowser,
 * same two filter axes, same cards — with the models each one brings listed on the card.
 *
 * Picking one opens the SAME details modal the services catalogue uses, and launching goes through the
 * SAME wizard (`/inference/services/[id]/…`) — a template is a template on the wire, so there is one
 * launch path.
 */
const TemplatesPage: React.FC = () => {
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
  const bundles = useMemo(() => selectBundles(catalogue), [catalogue]);
  // The template whose details are open. Picking one commits nothing — only a Continue/Advanced does.
  const [openBundle, setOpenBundle] = useState<AppBundle | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const templateEnvs = useTemplateEnvs(openBundle);

  // The browser hands back the AppTemplate it rendered; every entry it was given here is a bundle.
  const openDetails = (tpl: AppTemplate) => {
    setOpenBundle(tpl as AppBundle);
    setDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
  };

  // Same handoff as the services catalogue: commit template + env + token + duration, then straight to
  // payment with the bundle's pinned CPU/RAM/disk (its disk floor covers the weights it downloads).
  const continueToPayment = (entry: ResolvedTemplateEnv, token: SelectedToken, gpuSelection: GpuSelection) => {
    if (!openBundle) {
      return;
    }
    const env = { ...entry.env, gpuSelection };
    setSelectedTemplate(openBundle);
    setSelectedEnv(env);
    setSelectedToken(token);
    setJobDurationSeconds(durationSeconds);
    // A bundle whose gated model needs a token gets the config step first; otherwise straight to
    // payment (the modal already picked the env, so resources is skipped either way).
    const next = requiredEnvVars(openBundle).length > 0 ? 'config' : 'payment';
    router.push({
      pathname: `/inference/services/${encodeURIComponent(openBundle.id)}/${next}`,
      query: buildSelectionQuery({
        templateId: openBundle.id,
        peerId: env.nodeInfo.id,
        envId: env.environment.id,
        gpuSelection,
        sizing: env.sizing ?? templatePinnedSizing(openBundle),
        tokenAddress: token.address,
        durationSeconds,
      }),
    });
  };

  const goToAdvanced = () => {
    if (!openBundle) {
      return;
    }
    setSelectedTemplate(openBundle);
    setJobDurationSeconds(durationSeconds);
    router.push({
      pathname: `/inference/services/${encodeURIComponent(openBundle.id)}/resources`,
      query: buildSelectionQuery({ templateId: openBundle.id, durationSeconds }),
    });
  };

  // Nothing published: this node advertises services but no templates (or no templates at all). Say so
  // and point at the catalogue that does have something, rather than showing an empty grid.
  const emptyCatalogue = (
    <div className={styles.emptyState}>
      <Inventory2OutlinedIcon className={styles.emptyIcon} />
      <div className={styles.emptyTitle}>No templates on this node yet</div>
      <div className={styles.emptyHint}>
        Templates are published by the node you&apos;re connected to. This one advertises none right now — you can
        still start any service and add models from its own UI.
      </div>
      <Button
        className={styles.emptyReset}
        color="accent1"
        contentAfter={<ArrowForwardIcon />}
        href="/inference/services"
        size="sm"
      >
        Browse services
      </Button>
    </div>
  );

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch an app on an Ocean Node"
        contentBetween={
          <InferenceStepper currentStep="template" flowType={InferenceFlowType.Template} kindLabel="Template" />
        }
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <CatalogueBrowser
            emptyCatalogue={emptyCatalogue}
            error={error}
            heading="Pick a template"
            items={bundles}
            lead="An app with its models already included — pick what you want to get done and launch. The models download in the background while the app comes up."
            loading={loading}
            noun="template"
            nounPlural="templates"
            onOpen={openDetails}
            pathname="/inference/templates"
            searchPlaceholder="Search templates"
          />
        </Card>
      </div>

      <TemplateDetailsModal
        durationSeconds={durationSeconds}
        envs={templateEnvs}
        onAdvanced={goToAdvanced}
        onClose={() => setOpenBundle(null)}
        onContinue={continueToPayment}
        onDurationChange={setDurationSeconds}
        template={openBundle}
      />
    </Container>
  );
};

export default TemplatesPage;
