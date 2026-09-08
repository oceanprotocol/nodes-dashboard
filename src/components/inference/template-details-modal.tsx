import GpuIcon from '@/assets/icons/gpu.svg';
import Button from '@/components/button/button';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ResolvedTemplateEnv, TemplateEnvsState } from '@/components/hooks/use-template-envs';
import BundleIncludes, { IncludesAvatarCluster } from '@/components/inference/bundle-includes';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import TemplateDisclosure from '@/components/inference/template-disclosure';
import { templateLogo } from '@/components/inference/template-logos';
import TemplateMark from '@/components/inference/template-mark';
import {
  accentVars,
  templateGpuLabel,
  templateHardware,
  templateImageRef,
  visualFor,
} from '@/components/inference/template-visual';
import TemplateWorkflows from '@/components/inference/template-workflows';
import DurationInput from '@/components/input/duration-input';
import Modal from '@/components/modal/modal';
import { SelectedToken } from '@/context/run-job-context';
import { useTheme } from '@/lib/use-theme';
import { templateNeedsConfigStep } from '@/services/template-launch';
import { ComputeEnvironment } from '@/types/environments';
import {
  AppTemplate,
  INCLUDES_EXPAND_MAX,
  includesBreakdown,
  includesPublishers,
  SHAPE_LABEL,
  templateShape,
} from '@/types/templates';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration } from '@/utils/formatters';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DnsIcon from '@mui/icons-material/Dns';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LockIcon from '@mui/icons-material/Lock';
import MemoryIcon from '@mui/icons-material/Memory';
import PublicIcon from '@mui/icons-material/Public';
import RefreshIcon from '@mui/icons-material/Refresh';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { CircularProgress } from '@mui/material';
import cx from 'classnames';
import { CSSProperties, Fragment, useState } from 'react';
import styles from './template-details-modal.module.css';

type TemplateDetailsModalProps = {
  template: AppTemplate | null;
  envs: TemplateEnvsState;
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  onClose: () => void;
  /** Hand off to the full env picker (resources step) instead of launching from here. */
  onAdvanced: () => void;
  /** Continue from a specific env card → commit that env (with its fee token + GPU units) → payment. */
  /**
   * `environment` is the copy the card actually priced and validated the pick against — the node's
   * own, freshly re-read at click time. Forwarded so the flow stores and launches from the same
   * availability the user was shown; the entry's own `env.environment` is the resolver's older
   * snapshot, and committing that re-introduced the contention this whole path exists to catch.
   */
  onContinue: (
    resolvedEnv: ResolvedTemplateEnv,
    token: SelectedToken,
    gpuSelection: GpuSelection,
    environment: ComputeEnvironment
  ) => void;
};

/** Paid service-on-demand duration bounds for an env (0 / Infinity when unset). */
function durationBounds(environment: ComputeEnvironment): { min: number; max: number } {
  return { min: environment.minJobDuration ?? 0, max: environment.maxJobDuration ?? Infinity };
}

/** One row of the required-vs-recommended resources table. */
type ResourceRow = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  required: string;
  recommended: string;
};

const NOT_DECLARED = 'Not declared';

/**
 * The published `description`, as the paragraphs its author wrote. Split on blank lines because the
 * catalogue stores it as plain text: rendered into one <p>, HTML collapses the breaks and four
 * paragraphs arrive as a single block.
 *
 * Catalogue descriptions run to four paragraphs in a fixed shape — what it is, then two of operating
 * detail, then who it is for. Only the first and last are read while deciding, so those two stay
 * open and the middle sits behind the same More toggle the workflow cards use; all four at once is a
 * screen of grey between the header and "What you can run", which is the thing being chosen.
 *
 * The closing paragraph carries the template's own accent rule, since it is a different kind of
 * sentence from the spec above it. It is detected from the text rather than declared, so copy that
 * doesn't follow the pattern simply reads as body and nothing is hidden.
 */
const AUDIENCE_LINE = /^this template is built for\b/i;

const TemplateProse: React.FC<{ text: string; style?: CSSProperties }> = ({ text, style }) => {
  const [expanded, setExpanded] = useState(false);

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const last = paragraphs.length - 1;
  const hasAudience = last > 0 && AUDIENCE_LINE.test(paragraphs[last]);
  const audience = hasAudience ? paragraphs[last] : null;
  const middle = paragraphs.slice(1, hasAudience ? last : undefined);

  return (
    // `--accent` is set per template on the header, so the audience rule needs it carried here too.
    <div className={styles.overview} style={style}>
      <p className={styles.lead}>{paragraphs[0]}</p>
      {expanded &&
        middle.map((paragraph, i) => (
          <p className={styles.bodyProse} key={i}>
            {paragraph}
          </p>
        ))}
      {middle.length > 0 && (
        // Named rather than "More": a bare red word between two paragraphs reads as a warning, and
        // says nothing about what opens. The chevron matches the modal's other disclosures.
        <button className={styles.moreButton} onClick={() => setExpanded((open) => !open)} type="button">
          {expanded ? 'Hide how it runs' : 'How it runs'}
          <ExpandMoreIcon className={cx(styles.moreChevron, { [styles.moreChevronOpen]: expanded })} />
        </button>
      )}
      {audience && <p className={styles.audience}>{audience}</p>}
    </div>
  );
};

function resourceRows(template: AppTemplate): ResourceRow[] {
  const required = template.requiredResources ?? [];
  const recommended = template.recommendedResources ?? [];
  const declared = (id: string, unit: string) => {
    const req = required.find((r) => r.id === id);
    const rec = recommended.find((r) => r.id === id);
    return {
      required: req?.min != null ? `${req.min}${unit}` : NOT_DECLARED,
      // The node may publish recommendations either as a separate list or as `recommended` on the
      // requirement itself — take whichever is present.
      recommended:
        rec?.recommended != null
          ? `${rec.recommended}${unit}`
          : rec?.min != null
            ? `${rec.min}${unit}`
            : req?.recommended != null
              ? `${req.recommended}${unit}`
              : NOT_DECLARED,
    };
  };
  const gpuRequired = required.find((r) => r.type === 'gpu' || r.id === 'gpu');
  const gpuRecommended = recommended.find((r) => r.type === 'gpu' || r.id === 'gpu');
  const gpuUnits = gpuRecommended?.recommended ?? gpuRecommended?.min ?? gpuRequired?.recommended;
  // Icons match the environment cards: chip/memory glyph for CPU, SD-storage for RAM, DNS for disk,
  // generic GPU glyph for an unspecified GPU.
  return [
    { label: 'CPU', Icon: MemoryIcon, ...declared('cpu', ' cores') },
    { label: 'RAM', Icon: SdStorageIcon, ...declared('ram', ' GB') },
    { label: 'Disk', Icon: DnsIcon, ...declared('disk', ' GB') },
    {
      label: 'GPU',
      Icon: GpuIcon,
      required: gpuRequired ? `${gpuRequired.min}× GPU` : 'None',
      recommended: gpuRequired ? `${gpuUnits ?? gpuRequired.min}× GPU` : 'None',
    },
  ];
}

/**
 * "What's included" details for a picked app template: what the app is, how it's used (browser UI vs
 * HTTP API), its configurable env vars, the resources it asks for, the session length, and the
 * environments that can currently run it. Each env is a read-only card with its own Continue → payment (the resources step is
 * skipped); "Advanced setup" hands off to the full env picker instead. Selection lives in the parent —
 * closing this commits nothing.
 *
 * The first section varies by `templateShape`, and nothing else does — a returning user never has to
 * re-learn the modal:
 *
 * - **recipe** — the published `description` opens the modal as "What it is", then the graphs it
 *   ships, one bordered card each. The description used to be collapsed into "Good to know" because
 *   it restated those cards; catalogue copy is now written per template and says more than they do,
 *   so it leads — with only its opening and closing paragraphs open, so the graphs stay in view.
 * - **modelPack** — the manifest promoted into that same slot, annotated but visibly quieter, plus
 *   the absence of a workflow said out loud.
 * - **service** — plain prose and no panel at all. A bordered panel is this modal's way of saying
 *   "assets are included", so an empty app must not have one.
 */
const TemplateDetailsModal: React.FC<TemplateDetailsModalProps> = ({
  template,
  envs,
  durationSeconds,
  onDurationChange,
  onClose,
  onAdvanced,
  onContinue,
}) => {
  const { resolved, totalMatched, loading, loadError, retry } = envs;
  const { resolvedTheme } = useTheme();
  const visual = template ? visualFor(template.id, template.category) : null;
  const hw = template ? templateHardware(template) : null;
  const logo = template ? templateLogo(template) : null;
  const shape = template ? templateShape(template) : null;

  // The shared duration must land inside EVERY env's own window — validated per card so a card whose
  // env can't fit the current duration disables its Continue (with a reason). Same rule as quick start.
  const durationErrorFor = (environment: ComputeEnvironment): string | undefined => {
    const { min, max } = durationBounds(environment);
    if (durationSeconds < min) {
      return `This environment needs at least ${formatDuration(min)}.`;
    }
    if (durationSeconds > max) {
      return `This environment allows at most ${formatDuration(max)}.`;
    }
    return undefined;
  };

  // recommendedResources when the node published one, else requiredResources — recommendedResources is
  // null on every live template today, but the fallback keeps the offered GPU counts agreeing with the
  // seeded pick (use-template-envs reads the same preference for autoGpuSelection).
  const declaredResources = template?.recommendedResources ?? template?.requiredResources;

  const renderEnvsSection = () => {
    if (loadError) {
      return (
        <div className={styles.errorBox}>
          <ErrorOutlineIcon className={styles.errorIcon} />
          <div className={styles.errorText}>
            <div className={styles.errorTitle}>Couldn&apos;t load environments</div>
            <div className={styles.errorDetail}>
              Nothing has been committed. Retry, or close and pick another template.
            </div>
            <div className={styles.errorReason}>{loadError}</div>
          </div>
          <Button color="accent1" contentBefore={<RefreshIcon />} onClick={retry} size="sm" variant="filled">
            Retry
          </Button>
        </div>
      );
    }
    if (loading) {
      return (
        <div className={styles.skeletonList}>
          <div className={styles.skeletonCard}>
            <div className="shimmer" style={{ height: 12, width: 190 }} />
            <div className={styles.skeletonRow}>
              <div className="shimmer" style={{ height: 26, width: 150, borderRadius: 100 }} />
              <div className={styles.spacer} />
              <div className="shimmer" style={{ height: 34, width: 120, borderRadius: 100 }} />
            </div>
          </div>
          <div className={cx(styles.skeletonCard, styles.skeletonCardFaded)}>
            <div className="shimmer" style={{ height: 12, width: 150 }} />
            <div className="shimmer shimmerSoft" style={{ height: 34, borderRadius: 12 }} />
          </div>
          <div className={styles.loadingNote}>
            <CircularProgress className={styles.spinner} size={13} />
            Resolving environments that can run this image…
          </div>
        </div>
      );
    }
    if (resolved.length === 0) {
      return (
        <div className={styles.stateBox}>
          <CloudOffIcon className={styles.stateBoxIcon} />
          <div className={styles.stateBoxTitle}>No environment can run this template right now</div>
          <div className={styles.stateBoxText}>
            Every matching environment is busy or below this template&apos;s requirements. Try again shortly, or pick
            another template.
          </div>
        </div>
      );
    }
    return (
      <div className={styles.envList}>
        {/* Uncontrolled GPU chips: `initialSelection` seeds the auto-recommended pick (autoGpuSelection,
            via use-template-envs) and the card owns it from there, so the user can change the unit count
            without leaving for Advanced setup. onSelect hands back whatever they settled on — the same
            selection the card priced — which is what onContinue books. `sizing` is the template's PINNED
            CPU/RAM/disk, so a different GPU count moves the GPU units and the price, not the shared
            slice; same behavior as this template in the Advanced picker. disabledReason force-disables
            the play/price button (with a tooltip reason) when the shared duration is out of bounds. */}
        {resolved.map((entry) => (
          <InferenceEnvironmentCard
            allowZeroGpu
            declaredRequirements={declaredResources}
            disabledReason={durationErrorFor(entry.env.environment)}
            durationSeconds={durationSeconds}
            environment={entry.env.environment}
            initialSelection={entry.env.gpuSelection}
            key={`${entry.env.nodeInfo.id}-${entry.env.environment.id}`}
            nodeInfo={entry.env.nodeInfo}
            onSelect={(address, symbol, gpuSelection, environment) =>
              onContinue(entry, { address, symbol }, gpuSelection, environment)
            }
            sizing={entry.env.sizing}
          />
        ))}
        {totalMatched > resolved.length && (
          <div className={styles.envCapNote}>
            Showing the {resolved.length} best-scoring of {totalMatched} matching environments. Advanced setup lists
            them all.
          </div>
        )}
      </div>
    );
  };

  /**
   * The configurable-variable chips. Placement differs by shape, the markup doesn't. Rendered only
   * when the template actually declares variables — "declares no configurable variables" is a line
   * about the template's schema, not about anything the user can act on, and for a bare service it
   * was the whole of the section.
   *
   * The hint tracks routing rather than asserting it: only a launch that stops at the config step
   * (a required var, or a bucket picker — templateNeedsConfigStep) reaches the form from here, and a
   * template whose vars are all optional goes straight to payment, so "set on the next step" would
   * be pointing at a step this pick skips. Advanced setup always routes through config.
   */
  const renderEnvVars = (tpl: AppTemplate) => {
    const specs = tpl.userConfigurableEnvVars ?? [];
    if (specs.length === 0) {
      return null;
    }
    return (
      <div className={styles.envVars}>
        <div className={styles.envVarsHead}>
          <span className={styles.overline}>Configurable env vars</span>
          <span className="textSecondary text12">
            {templateNeedsConfigStep(tpl) ? 'set on the next step' : 'optional · set under Advanced setup'}
          </span>
        </div>
        <div className={styles.envVarList}>
          {specs.map((spec) => (
            <span className={cx('chip', 'chipGlass', styles.chip, styles.envVarChip)} key={spec.key}>
              {spec.sensitive && <LockIcon className={styles.envVarLock} />}
              {spec.key}
              {spec.sensitive && <span className={styles.envVarMask}>••••••</span>}
            </span>
          ))}
        </div>
      </div>
    );
  };

  /**
   * How you reach the running app. No port number: the node allocates a host port from 30000-32767 at
   * launch and the URL carries that one, so naming the container port here would show a number that
   * appears nowhere in the endpoint the user is given.
   */
  const renderPortRow = () =>
    visual && (
      <div className={styles.portRow}>
        <span className={cx('chip chipAccent2', styles.chip)}>
          <PublicIcon className={styles.chipIcon} />
          {visual.meta.interaction}
        </span>
        <span className="textSecondary text12">{visual.meta.interactionHint}</span>
      </div>
    );

  /**
   * The overview, first thing under the header. It used to sit inside "Good to know", collapsed, on
   * the reasoning that for a bundle it restated the workflow descriptions — that stopped being true
   * once the catalogue started publishing a full description per template, and a paragraph nobody
   * opens is a paragraph nobody reads. Workflows still follow: overview first, then the detail.
   */
  const renderOverview = (tpl: AppTemplate) => {
    const description = tpl.description?.trim();
    if (!description || !visual) {
      return null;
    }
    return (
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h4>What it is</h4>
        </div>
        <TemplateProse style={accentVars(visual.meta.accent, resolvedTheme) as CSSProperties} text={description} />
      </div>
    );
  };

  /**
   * The env vars, behind one row: which variables exist is a launch-time detail, not something read
   * while deciding. Available, out of the way — and keeping them here stops the header carrying two
   * competing chip rows.
   */
  const renderGoodToKnow = (tpl: AppTemplate) => {
    if ((tpl.userConfigurableEnvVars?.length ?? 0) === 0) {
      return null;
    }
    return (
      <div className={styles.section}>
        <TemplateDisclosure Icon={InfoOutlinedIcon} summary="Good to know: the variables you can set">
          {renderEnvVars(tpl)}
        </TemplateDisclosure>
      </div>
    );
  };

  /**
   * The manifest — what the graphs load. Collapsed by default: today this list outranks the recipe,
   * and six near-identical checkpoint names are not what anyone is deciding on. The avatar cluster
   * keeps the provenance signal while closed and the publisher names do the credibility work the list
   * was doing, which buys Resources/Runtime/Environment roughly a screen of scroll.
   */
  const renderUnderTheHood = (tpl: AppTemplate) => {
    const breakdown = includesBreakdown(tpl);
    const publishers = includesPublishers(tpl);
    return (
      <div className={styles.section}>
        <div className={styles.overlineHead}>
          <span className={styles.overline}>Under the hood</span>
          <span className="textSecondary text12">what the graphs load</span>
        </div>
        <TemplateDisclosure
          closeLabel="Hide"
          openLabel={`Show all ${tpl.includes?.length ?? 0}`}
          raised
          contentIsPanel
          summary={
            <span className={styles.clusterSummary}>
              <IncludesAvatarCluster template={tpl} />
              <span>
                {breakdown}, downloaded into the app on first launch
                {publishers ? `, from ${publishers}` : ''}
              </span>
            </span>
          }
        >
          <BundleIncludes template={tpl} />
        </TemplateDisclosure>
      </div>
    );
  };

  /**
   * The first section — the only thing that varies between the three shapes. See the component
   * docblock for why each one looks the way it does.
   */
  const renderOfferSection = (tpl: AppTemplate) => {
    if (!visual) {
      return null;
    }
    const workflows = tpl.workflows ?? [];
    const includes = tpl.includes ?? [];

    if (shape === 'recipe') {
      return (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h4>What you can run</h4>
            {/* No entry point named here either — see TemplateWorkflows on why position isn't rank. */}
            <div>
              {workflows.length === 1
                ? 'One graph, already loaded in the app.'
                : `${workflows.length} graphs, already loaded in the app.`}
            </div>
          </div>
          <TemplateWorkflows workflows={workflows} />
          {renderPortRow()}
        </div>
      );
    }

    if (shape === 'modelPack') {
      const breakdown = includesBreakdown(tpl);
      const publishers = includesPublishers(tpl);
      return (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h4>What you get</h4>
            <div>
              {visual.meta.purpose} The models below are already downloaded, but no workflow is preloaded, so you build
              your own.
            </div>
          </div>
          <div className={styles.panel}>
            {/* Three annotated items answer a real question when you're wiring your own graph; past
                that the list is noise whichever way you cut it, so it collapses. */}
            {includes.length <= INCLUDES_EXPAND_MAX ? (
              <BundleIncludes showRoles template={tpl} />
            ) : (
              <TemplateDisclosure
                closeLabel="Hide"
                contentIsPanel
                openLabel={`Show all ${includes.length}`}
                raised
                summary={
                  <span className={styles.clusterSummary}>
                    <IncludesAvatarCluster template={tpl} />
                    <span>
                      {breakdown}
                      {publishers ? `, from ${publishers}` : ''}
                    </span>
                  </span>
                }
              >
                <BundleIncludes showRoles template={tpl} />
              </TemplateDisclosure>
            )}
            {/* Said out loud, not left to be discovered after paying. */}
            <div className={styles.absence}>
              <AccountTreeOutlinedIcon className={styles.absenceIcon} />
              <div>
                <strong>No workflows included.</strong> The app opens empty, so build a graph or bring your own. The
                models above are already in place, so they show up in the app straight away.
              </div>
            </div>
            {renderPortRow()}
          </div>
        </div>
      );
    }

    // service — plain prose, no panel. The shortness is itself the signal that this is a bare app.
    return (
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h4>What you get</h4>
          <div>{visual.meta.purpose} You bring the models.</div>
        </div>
        {tpl.description ? (
          <TemplateProse text={tpl.description} />
        ) : (
          <p className={cx(styles.prose, styles.descriptionEmpty)}>No description published for this image.</p>
        )}
        {(tpl.capabilities?.length ?? 0) > 0 && (
          <div className={styles.capabilities}>
            {tpl.capabilities?.map((capability) => (
              <span className={cx('chip', styles.chip, styles.capabilityChip)} key={capability}>
                {capability}
              </span>
            ))}
          </div>
        )}
        {renderPortRow()}
        {/* Renders as a stated absence rather than not at all: the heading keeps the section rhythm
            of a bundle's modal, and silence here would read as an oversight instead of a choice. */}
        <div className={styles.overlineHead}>
          <span className={styles.overline}>Under the hood</span>
        </div>
        <div className={styles.absence}>
          <Inventory2OutlinedIcon className={styles.absenceIcon} />
          <div>
            <strong>Ships empty - no models, no workflows.</strong> Fetch what you need from inside the app once it is
            running.
          </div>
        </div>
        {renderEnvVars(tpl)}
      </div>
    );
  };

  return (
    <Modal isOpen={!!template} onClose={onClose} title="What's included" width="md">
      {template && visual && hw && (
        <>
          <div className={styles.header} style={accentVars(visual.meta.accent, resolvedTheme) as CSSProperties}>
            {/* The brand mark REPLACES the category glyph — see the same note in template-card. */}
            <TemplateMark
              fallback={
                <span className={styles.tile}>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className={styles.tileLogo} src={logo} />
                  ) : visual.mono ? (
                    <span className={styles.tileMono}>{visual.mono}</span>
                  ) : (
                    <visual.meta.Icon className={styles.tileIcon} />
                  )}
                </span>
              }
              size={38}
              template={template}
            />
            <div className={styles.headerText}>
              <h2 className={styles.name}>{template.name ?? template.id}</h2>
              {/* Templates only: the one concrete thing this gets done. The catalogue card leads with
                  the app's name (same tile as a service), so this is where the outcome is read. */}
              {template.outcome && <div className={styles.outcome}>{template.outcome}</div>}
              <div className={cx(styles.headerChips, 'gapSm')}>
                <span className={cx('chip', styles.chip, styles.categoryChip)}>{visual.meta.label}</span>
                {/* Same chip as the catalogue card — same icon, same words for the same ask. */}
                <span className={cx('chip', 'chipGlass', styles.chip)}>
                  {hw.gpu ? (
                    <GpuIcon className={styles.chipIcon} />
                  ) : (
                    <MemoryIcon className={styles.chipIcon} fontSize="small" />
                  )}
                  {templateGpuLabel(hw)}
                </span>
                {/* Three tiers, one word each — a buyer who expects a runnable recipe and gets three
                    checkpoints will ask for a refund, so the distinction is worth a chip. */}
                {shape && <span className={cx('chip', styles.chip, styles.shapeChip)}>{SHAPE_LABEL[shape]}</span>}
              </div>
              <div className={styles.mono} title={templateImageRef(template)}>
                {templateImageRef(template)}
              </div>
            </div>
          </div>

          {shape !== 'service' && renderOverview(template)}

          {renderOfferSection(template)}

          {shape !== 'service' && renderGoodToKnow(template)}

          {shape === 'recipe' && (template.includes?.length ?? 0) > 0 && renderUnderTheHood(template)}

          {/* Resources table (Resource / Required / Recommended) — commented out. It printed the
              template's declared CPU/RAM/disk as the amounts a launch would book, which stopped being
              true once the shared slice became proportional to the GPU count picked below
              (templateFloorSizing): the declared figures are now a FLOOR, not the booking. The env
              cards under "Environment" show the real amounts for the current pick, and the card's GPU
              chip carries the declared ask. Kept rather than deleted — `resourceRows`/`NOT_DECLARED`
              and the resourceTable styles are still here if a declared-vs-booked table is wanted back.
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h4>Resources</h4>
              <div>What the template asks for. The environment you pick must meet the required column.</div>
            </div>
            <div className={styles.resourceTable}>
              <div className={styles.resourceHeadCell}>Resource</div>
              <div className={styles.resourceHeadCell}>Required</div>
              <div className={cx(styles.resourceHeadCell, styles.resourceHeadCellAccent)}>Recommended</div>
              {resourceRows(template).map((row) => (
                <Fragment key={row.label}>
                  <div className={styles.resourceLabelCell}>
                    <row.Icon className={styles.resourceIcon} />
                    {row.label}
                  </div>
                  <div
                    className={cx(styles.resourceCell, { [styles.resourceCellEmpty]: row.required === NOT_DECLARED })}
                  >
                    {row.required}
                  </div>
                  <div
                    className={cx(styles.resourceCell, {
                      [styles.resourceCellAccent]: row.recommended !== NOT_DECLARED,
                      [styles.resourceCellEmpty]: row.recommended === NOT_DECLARED,
                    })}
                  >
                    {row.recommended}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
          */}

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h4>Runtime</h4>
              <div>
                You can prolong a running session later from its manage page.
                <br />
                Prices below are shown for this <strong>selected duration</strong>
              </div>
            </div>
            <DurationInput
              availableUnits={DURATION_UNIT_OPTIONS}
              className={styles.durationInput}
              defaultUnit="hours"
              label="Session length"
              min={1}
              onChange={onDurationChange}
              size="sm"
              value={durationSeconds}
            />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeadRow}>
              <div className={styles.sectionHead}>
                <h4>Environment</h4>
                <div>Pick an environment to launch on. Continue takes you straight to payment.</div>
              </div>
            </div>
            {renderEnvsSection()}
          </div>

          <div className="actionsGroupMdBetween">
            <Button color="accent1" onClick={onClose} variant="outlined">
              Close
            </Button>
            <Button color="accent1" contentBefore={<TuneOutlinedIcon />} onClick={onAdvanced} variant="outlined">
              Advanced setup
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default TemplateDetailsModal;
