import GpuIcon from '@/assets/icons/gpu.svg';
import Button from '@/components/button/button';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ResolvedTemplateEnv, TemplateEnvsState } from '@/components/hooks/use-template-envs';
import BundleIncludes, { IncludesAvatarCluster } from '@/components/inference/bundle-includes';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import TemplateDisclosure from '@/components/inference/template-disclosure';
import { templateLogo } from '@/components/inference/template-logos';
import { accentVars, templateHardware, templateImageRef, visualFor } from '@/components/inference/template-visual';
import TemplateWorkflows from '@/components/inference/template-workflows';
import DurationInput from '@/components/input/duration-input';
import Modal from '@/components/modal/modal';
import { SelectedToken } from '@/context/run-job-context';
import { useTheme } from '@/lib/use-theme';
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
import { CSSProperties, Fragment } from 'react';
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
  onContinue: (resolvedEnv: ResolvedTemplateEnv, token: SelectedToken, gpuSelection: GpuSelection) => void;
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
 * - **recipe** — the graphs it ships, one bordered card each. They are the offer, so they take the
 *   largest share of the modal, and the published `description` (which restates them almost sentence
 *   for sentence) moves into "Good to know" rather than opening the modal with a prose wall.
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

  const renderEnvsSection = () => {
    if (loadError) {
      return (
        <div className={styles.errorBox}>
          <ErrorOutlineIcon className={styles.errorIcon} />
          <div className={styles.errorText}>
            <div className={styles.errorTitle}>Couldn&apos;t load environments</div>
            <div className={styles.errorDetail}>
              Nothing has been committed — retry, or close and pick another template.
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
        {/* Controlled gpuSelection → static chips (read-only, auto recommended). onSelect drives its own
            play/price button; disabledReason force-disables it (with a tooltip reason) when the shared
            duration is out of this env's bounds. */}
        {resolved.map((entry) => (
          <InferenceEnvironmentCard
            disabledReason={durationErrorFor(entry.env.environment)}
            durationSeconds={durationSeconds}
            environment={entry.env.environment}
            gpuSelection={entry.env.gpuSelection}
            key={`${entry.env.nodeInfo.id}-${entry.env.environment.id}`}
            nodeInfo={entry.env.nodeInfo}
            onSelect={(address, symbol, gpuSelection) => onContinue(entry, { address, symbol }, gpuSelection)}
            sizing={entry.env.sizing}
          />
        ))}
        {totalMatched > resolved.length && (
          <div className={styles.envCapNote}>
            Showing the {resolved.length} best-scoring of {totalMatched} matching environments — Advanced setup lists
            them all.
          </div>
        )}
      </div>
    );
  };

  /** The configurable-variable chips. Placement differs by shape, the markup doesn't. */
  const renderEnvVars = (tpl: AppTemplate) => (
    <div className={styles.envVars}>
      <div className={styles.envVarsHead}>
        <span className={styles.overline}>Configurable env vars</span>
        <span className="textSecondary text12">optional · set on the next step</span>
      </div>
      {tpl.userConfigurableEnvVars && tpl.userConfigurableEnvVars.length > 0 ? (
        <div className={styles.envVarList}>
          {tpl.userConfigurableEnvVars.map((spec) => (
            <span className={cx('chip', 'chipGlass', styles.chip, styles.envVarChip)} key={spec.key}>
              {spec.sensitive && <LockIcon className={styles.envVarLock} />}
              {spec.key}
              {spec.sensitive && <span className={styles.envVarMask}>••••••</span>}
            </span>
          ))}
        </div>
      ) : (
        <span className={styles.emptyNote}>This template declares no configurable variables.</span>
      )}
    </div>
  );

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
   * The published `description`, plus the env vars, behind one row. For a bundle this paragraph is
   * documentation rather than a decision: it restates the workflow descriptions and then adds the
   * operational footnotes (storage, first launch, which variables exist) that nothing else carries.
   * Available, out of the way — and it is also where the env-var chips move to, so the header stops
   * carrying two competing chip rows.
   */
  const renderGoodToKnow = (tpl: AppTemplate) => {
    const description = tpl.description?.trim();
    const hasEnvVars = (tpl.userConfigurableEnvVars?.length ?? 0) > 0;
    if (!description && !hasEnvVars) {
      return null;
    }
    return (
      <div className={styles.section}>
        <TemplateDisclosure
          Icon={InfoOutlinedIcon}
          summary={
            hasEnvVars ? 'Good to know — how it runs, and the variables you can set' : 'Good to know — how it runs'
          }
        >
          {description && <p className={styles.notesProse}>{description}</p>}
          {hasEnvVars && renderEnvVars(tpl)}
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
                {publishers ? ` — from ${publishers}` : ''}
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
              {visual.meta.purpose} The models below are already downloaded — no workflow is preloaded, so you build
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
                      {publishers ? ` — from ${publishers}` : ''}
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
                <strong>No workflows included.</strong> The app opens empty — build a graph, or bring your own. The
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
        <p className={cx(styles.prose, { [styles.descriptionEmpty]: !tpl.description })}>
          {tpl.description || 'No description published for this image.'}
        </p>
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
            <strong>Ships empty — no models, no workflows.</strong> Fetch what you need from inside the app once it is
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
            <div className={styles.headerText}>
              <h2 className={styles.name}>{template.name ?? template.id}</h2>
              {/* Templates only: the one concrete thing this gets done. The catalogue card leads with
                  the app's name (same tile as a service), so this is where the outcome is read. */}
              {template.outcome && <div className={styles.outcome}>{template.outcome}</div>}
              <div className={cx(styles.headerChips, 'gapSm')}>
                <span className={cx('chip', styles.chip, styles.categoryChip)}>{visual.meta.label}</span>
                <span className={cx('chip', styles.chip, hw.gpu ? 'chipAccent2' : 'chipGlass')}>
                  {hw.gpu ? (
                    <GpuIcon className={styles.chipIcon} />
                  ) : (
                    <MemoryIcon className={styles.chipIcon} fontSize="small" />
                  )}
                  {hw.gpu ? 'GPU' : 'CPU'}
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

          {renderOfferSection(template)}

          {shape !== 'service' && renderGoodToKnow(template)}

          {shape === 'recipe' && (template.includes?.length ?? 0) > 0 && renderUnderTheHood(template)}

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
