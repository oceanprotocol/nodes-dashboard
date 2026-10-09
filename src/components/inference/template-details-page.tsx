import GpuIcon from '@/assets/icons/gpu.svg';
import useQuickStart, { QuickStartPick } from '@/components/hooks/use-quick-start';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import useTemplateEnvs, { ResolvedTemplateEnv } from '@/components/hooks/use-template-envs';
import BundleIncludes, { IncludesAvatarCluster } from '@/components/inference/bundle-includes';
import { CatalogueConfig, catalogueFor } from '@/components/inference/catalogue-config';
import {
  DetailsChip,
  DetailsDisclosure,
  DetailsDisclosureIcon,
  DetailsDisclosureLabel,
  DetailsHeader,
  DetailsLayout,
  DetailsMissing,
  DetailsNote,
  DetailsPage,
  DetailsSection,
  DetailsSkeleton,
  DetailsTile,
} from '@/components/inference/details-page';
import QuickStartBanner from '@/components/inference/quick-start-banner';
import { templateLogo } from '@/components/inference/template-logos';
import TemplateMark from '@/components/inference/template-mark';
import {
  accentVars,
  templateGpuLabel,
  templateHardware,
  templateImageRef,
  templateVendor,
  TemplateVisual,
  visualFor,
} from '@/components/inference/template-visual';
import TemplateWorkflows from '@/components/inference/template-workflows';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { InferenceOpenedVia, resolveInferenceBranch, trackInferenceSelection } from '@/lib/inference-analytics';
import { useTheme } from '@/lib/use-theme';
import { detailsPath, firstQueryValue, INFERENCE_PATHS } from '@/services/inference-url';
import { declaredGpuRange } from '@/services/quick-start';
import { findTemplateById } from '@/services/service-templates';
import { showcaseItemsForSource } from '@/services/showcase';
import { templateNeedsConfigStep } from '@/services/template-launch';
import { InferenceFlowType } from '@/types/inference';
import {
  AppTemplate,
  INCLUDES_EXPAND_MAX,
  includesBreakdown,
  includesPublishers,
  isBundle,
  SHAPE_LABEL,
  templateShape,
} from '@/types/templates';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LockIcon from '@mui/icons-material/Lock';
import MemoryIcon from '@mui/icons-material/Memory';
import PublicIcon from '@mui/icons-material/Public';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useRouter } from 'next/router';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import styles from './template-details-page.module.css';

/**
 * A catalogue pick, sent as `inference_template_selected`. The card click reports `click` before
 * navigating here, and this page reports `link` once the entry resolves, which trackInferenceSelection
 * drops when the click already counted it (see there).
 */
export const trackTemplateOpened = (tpl: AppTemplate, openedVia: InferenceOpenedVia) => {
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

/**
 * Catalogue descriptions run to four paragraphs in a fixed shape: what it is, two of operating detail,
 * then who it is for. The first and last stay open and the middle sits in a "How it runs" card. The closing
 * paragraph is detected from the text rather than declared, so copy that doesn't follow the pattern
 * simply reads as body and nothing is hidden.
 */
const AUDIENCE_LINE = /^this template is built for\b/i;

/**
 * Renders `[text](url)` markdown-style links in a paragraph, so a credited source can show as a
 * name instead of a bare URL. Anything outside that syntax passes through as plain text.
 */
const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const linkify = (text: string): React.ReactNode => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }
    nodes.push(
      <a key={index} href={match[2]} target="_blank" rel="noreferrer" className={styles.proseLink}>
        {match[1]}
      </a>
    );
    lastIndex = index + match[0].length;
  }
  nodes.push(text.slice(lastIndex));
  return nodes;
};

/**
 * The published `description`, as the paragraphs its author wrote. Split on blank lines because the
 * catalogue stores it as plain text, and one <p> would collapse the breaks.
 */
const TemplateProse: React.FC<{ text: string }> = ({ text }) => {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const last = paragraphs.length - 1;
  const hasAudience = last > 0 && AUDIENCE_LINE.test(paragraphs[last]);
  const audience = hasAudience ? paragraphs[last] : null;
  const middle = paragraphs.slice(1, hasAudience ? last : undefined);

  return (
    <>
      <div className={styles.prose}>
        <p className={styles.lead}>{linkify(paragraphs[0])}</p>
        {audience && <p className={styles.audience}>{linkify(audience)}</p>}
      </div>
      {middle.length > 0 && (
        <DetailsDisclosure
          summary={
            <>
              <DetailsDisclosureIcon Icon={SettingsOutlinedIcon} />
              <DetailsDisclosureLabel title="How it runs" />
            </>
          }
        >
          <div className={styles.prose}>
            {middle.map((paragraph, i) => (
              <p className={styles.body} key={i}>
                {linkify(paragraph)}
              </p>
            ))}
          </div>
        </DetailsDisclosure>
      )}
    </>
  );
};

/** The manifest's disclosure summary: avatar cluster, what it holds, and where it comes from. */
const IncludesSummary: React.FC<{ template: AppTemplate; downloaded?: boolean }> = ({
  template,
  downloaded = false,
}) => {
  const publishers = includesPublishers(template);
  const origin = [downloaded && 'Downloaded into the app on first launch', publishers && `from ${publishers}`]
    .filter(Boolean)
    .join(', ');
  return (
    <>
      <IncludesAvatarCluster template={template} />
      <DetailsDisclosureLabel
        sub={origin ? origin.charAt(0).toUpperCase() + origin.slice(1) : undefined}
        title={includesBreakdown(template)}
      />
    </>
  );
};

/**
 * How you reach the running app. No port number: the node allocates a host port from 30000-32767 at
 * launch and the URL carries that one, so the container port would appear nowhere the user looks.
 */
const AccessNote: React.FC<{ visual: TemplateVisual }> = ({ visual }) => (
  <DetailsNote Icon={PublicIcon} title={visual.meta.interaction}>
    {visual.meta.interactionHint}.
  </DetailsNote>
);

/**
 * The details page of one catalogue entry: /inference/services/[templateId] for a service and
 * /inference/templates/[templateId] for a template (a bundle on the wire). Laid out like the package
 * page (see details-page.tsx): identity header, quick start banner, then the same sections in the same
 * order for every template:
 *
 * 1. **What it is**: the published description.
 * 2. **What you can run / What you get**: the only section that varies by `templateShape`. A recipe
 *    lists its graphs, a model pack its models plus the absence of a workflow, a service its
 *    capabilities. Each ends with how the running app is reached.
 * 3. **Under the hood**: what the app downloads (recipe), or that it ships empty (service). A model
 *    pack has none, since its models are already the offer above.
 * 4. **Configurable variables**: only when the template declares some.
 *
 * The banner picks the environment itself (see useQuickStart), so the user only sets a session length
 * and presses Start; Advanced setup hands off to the full env picker. Viewing commits nothing to the
 * inference context, only a Start/Advanced does, and a bundle is a template on the wire, so the wizard
 * is `/inference/services/[templateId]/…` for both catalogues.
 */
const TemplateDetailsPage: React.FC<{ catalogue: CatalogueConfig }> = ({ catalogue }) => {
  const router = useRouter();
  const {
    setSelectedTemplate,
    setSelectedEnv,
    setSelectedToken,
    setJobDurationSeconds,
    clearSelection,
    buildSelectionQuery,
  } = useInferenceContext();

  const templateId = firstQueryValue(router.query.templateId);
  const { templates, loading, error } = useServiceTemplates();
  const found = useMemo(() => (templateId ? findTemplateById(templates, templateId) : null), [templates, templateId]);
  // Listed on the other catalogue (a bundle linked under /services, or the reverse): shown only where it
  // is listed, so the back link and stepper name the right one.
  const misplaced = !!found && catalogueFor(found) !== catalogue;
  const template = misplaced ? null : found;

  useEffect(() => {
    if (found && misplaced) {
      router.replace(detailsPath(catalogueFor(found).pathname, found.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found, misplaced]);

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (template) {
      trackTemplateOpened(template, 'link');
    }
  }, [template]);

  // Session length, kept local until a Start/Advanced handoff.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);
  const { resolved, loading: envsLoading, loadError, retry } = useTemplateEnvs(template);
  const { resolvedTheme } = useTheme();
  const visual = template ? visualFor(template.id, template.category) : null;
  const hw = template ? templateHardware(template) : null;
  const logo = template ? templateLogo(template) : null;
  const shape = template ? templateShape(template) : null;

  /**
   * Quick start confirmed a pick: commit template + env + token + duration, then step forward. The
   * resources step is skipped (the banner already picked the env). Config always shows result storage
   * and any configurable env vars before payment. The query is built
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
    if (!template) {
      return;
    }
    const env = { ...entry.env, gpuSelection, environment, sizing };
    setSelectedTemplate(template);
    setSelectedEnv(env);
    setSelectedToken(token);
    setJobDurationSeconds(durationSeconds);
    const next = templateNeedsConfigStep(template) ? 'config' : 'payment';
    router.push({
      pathname: `${detailsPath(INFERENCE_PATHS.services, template.id)}/${next}`,
      query: buildSelectionQuery({
        templateId: template.id,
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
    if (!template) {
      return;
    }
    setSelectedTemplate(template);
    setJobDurationSeconds(durationSeconds);
    router.push({
      pathname: `${detailsPath(INFERENCE_PATHS.services, template.id)}/resources`,
      query: buildSelectionQuery({ templateId: template.id, durationSeconds }),
    });
  };

  // The GPU count the quick start aims for (recommended) and may scale down to (required min).
  const gpuRange = useMemo(
    () => (template ? declaredGpuRange(template.requiredResources, template.recommendedResources) : null),
    [template]
  );

  // Templates are one of the two zero-GPU flows (see env-resources.ts): an app declaring no GPU
  // (jupyterlab, hermes) launches without one wherever the environment allows that.
  const quickStart = useQuickStart({
    entries: resolved,
    loading: envsLoading,
    loadError,
    retry,
    gpuRange,
    allowZeroGpu: true,
    durationSeconds,
    onStart: continueToPayment,
  });

  const renderOverview = (tpl: AppTemplate) => {
    const description = tpl.description?.trim();
    if (description) {
      return (
        <DetailsSection title="What it is">
          <TemplateProse text={description} />
        </DetailsSection>
      );
    }
    // A bare service has nothing else describing it, so its missing description is said out loud.
    if (shape === 'service') {
      return (
        <DetailsSection title="What it is">
          <p className={styles.empty}>No description published for this image.</p>
        </DetailsSection>
      );
    }
    return null;
  };

  const renderOffer = (tpl: AppTemplate, meta: TemplateVisual) => {
    const workflows = tpl.workflows ?? [];
    const includes = tpl.includes ?? [];

    if (shape === 'recipe') {
      return (
        <DetailsSection
          hint={
            workflows.length === 1
              ? 'One graph, already loaded in the app.'
              : `${workflows.length} graphs, already loaded in the app.`
          }
          title="What you can run"
        >
          <TemplateWorkflows workflows={workflows} />
          <AccessNote visual={meta} />
        </DetailsSection>
      );
    }

    if (shape === 'modelPack') {
      return (
        <DetailsSection
          hint={`${meta.meta.purpose} The models below are already downloaded, but no workflow is preloaded, so you build your own.`}
          title="What you get"
        >
          {/* A few annotated items help when wiring your own graph; past that the list collapses. */}
          {includes.length <= INCLUDES_EXPAND_MAX ? (
            <BundleIncludes showRoles template={tpl} />
          ) : (
            <DetailsDisclosure summary={<IncludesSummary template={tpl} />}>
              <BundleIncludes showRoles template={tpl} />
            </DetailsDisclosure>
          )}
          <DetailsNote Icon={AccountTreeOutlinedIcon} title="No workflows included.">
            The app opens empty, so build a graph or bring your own. The models above are already in place, so they show
            up in the app straight away.
          </DetailsNote>
          <AccessNote visual={meta} />
        </DetailsSection>
      );
    }

    return (
      <DetailsSection hint={`${meta.meta.purpose} You bring the models.`} title="What you get">
        {(tpl.capabilities?.length ?? 0) > 0 && (
          <div className={styles.chipList}>
            {tpl.capabilities?.map((capability) => (
              <DetailsChip key={capability} tone="quiet">
                {capability}
              </DetailsChip>
            ))}
          </div>
        )}
        <AccessNote visual={meta} />
      </DetailsSection>
    );
  };

  const renderUnderTheHood = (tpl: AppTemplate) => {
    if (shape === 'service') {
      return (
        <DetailsSection title="Under the hood">
          <DetailsNote Icon={Inventory2OutlinedIcon} title="Ships empty - no models, no workflows.">
            Fetch what you need from inside the app once it is running.
          </DetailsNote>
        </DetailsSection>
      );
    }
    if (shape === 'recipe' && (tpl.includes?.length ?? 0) > 0) {
      return (
        <DetailsSection hint="What the graphs load." title="Under the hood">
          <DetailsDisclosure summary={<IncludesSummary downloaded template={tpl} />}>
            <BundleIncludes template={tpl} />
          </DetailsDisclosure>
        </DetailsSection>
      );
    }
    return null;
  };

  /** Template launches configure result storage and env vars on the next step. */
  const renderEnvVars = (tpl: AppTemplate) => {
    const specs = tpl.userConfigurableEnvVars ?? [];
    if (specs.length === 0) {
      return null;
    }
    return (
      <DetailsSection
        hint={templateNeedsConfigStep(tpl) ? 'Set on the next step.' : 'Optional, set under Advanced setup.'}
        title="Configurable variables"
      >
        <div className={styles.chipList}>
          {specs.map((spec) => (
            <DetailsChip className={styles.envVarChip} key={spec.key}>
              {spec.sensitive && <LockIcon className={styles.envVarLock} />}
              {spec.key}
              {spec.sensitive && <span className={styles.envVarMask}>••••••</span>}
            </DetailsChip>
          ))}
        </div>
      </DetailsSection>
    );
  };

  // The template's category colour, carried by the header, the banner and the prose accents alike.
  const accentStyle = visual ? (accentVars(visual.meta.accent, resolvedTheme) as CSSProperties) : undefined;

  const browse = { href: catalogue.pathname, label: `Browse ${catalogue.nounPlural}` };

  const renderBody = () => {
    // Still loading, or on its way to the catalogue that lists it.
    if (!router.isReady || (loading && !found) || misplaced) {
      return <DetailsSkeleton />;
    }
    if (!template || !visual || !hw) {
      return error ? (
        <DetailsMissing action={browse} title={`Couldn't load ${catalogue.nounPlural}`}>
          {error}
        </DetailsMissing>
      ) : (
        <DetailsMissing action={browse} title={`This ${catalogue.noun} isn't available`}>
          The node you&apos;re connected to doesn&apos;t list &ldquo;{templateId}&rdquo; right now. It may have been
          renamed or withdrawn.
        </DetailsMissing>
      );
    }
    return (
      // `--accent` is set once for the whole layout, so every card inherits the category colour.
      <DetailsLayout
        back={{ pathname: catalogue.pathname, label: `Back to ${catalogue.nounPlural}` }}
        header={
          <DetailsHeader
            chips={
              <>
                <DetailsChip tone="accent">{visual.meta.label}</DetailsChip>
                {/* Same chip as the catalogue card: same icon, same words for the same ask. */}
                <DetailsChip>
                  {hw.gpu ? <GpuIcon /> : <MemoryIcon />}
                  {templateGpuLabel(hw)}
                </DetailsChip>
                {shape && <DetailsChip tone="quiet">{SHAPE_LABEL[shape]}</DetailsChip>}
              </>
            }
            mark={
              // The brand mark replaces the category glyph (same as template-card).
              <TemplateMark
                fallback={
                  <DetailsTile>
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className={styles.tileLogo} src={logo} />
                    ) : visual.mono ? (
                      <span className={styles.tileMono}>{visual.mono}</span>
                    ) : (
                      <visual.meta.Icon className={styles.tileIcon} />
                    )}
                  </DetailsTile>
                }
                size={52}
                template={template}
              />
            }
            meta={templateImageRef(template)}
            name={template.name ?? template.id}
            subtitle={template.outcome}
          />
        }
        launch={
          <QuickStartBanner
            durationSeconds={durationSeconds}
            onAdvanced={goToAdvanced}
            onDurationChange={setDurationSeconds}
            quickStart={quickStart}
          />
        }
        showcase={showcaseItemsForSource(isBundle(template) ? 'template' : 'service', template.id)}
        style={accentStyle}
      >
        {renderOverview(template)}
        {renderOffer(template, visual)}
        {renderUnderTheHood(template)}
        {renderEnvVars(template)}
      </DetailsLayout>
    );
  };

  return <DetailsPage>{renderBody()}</DetailsPage>;
};

export default TemplateDetailsPage;
