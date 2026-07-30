import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import useTemplateEnvs, { ResolvedTemplateEnv } from '@/components/hooks/use-template-envs';
import InferenceStepper from '@/components/inference/inference-stepper';
import TemplateDetailsModal from '@/components/inference/template-details-modal';
import { templateLogoSrc } from '@/components/inference/template-logos';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  TemplateCategory,
  templateHardware,
  templateVendor,
  visualFor,
} from '@/components/inference/template-visual';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { firstQueryValue } from '@/services/inference-url';
import { templatePinnedSizing, templatePrimaryPort } from '@/services/template-launch';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate } from '@/types/templates';
import AppsIcon from '@mui/icons-material/Apps';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import LanIcon from '@mui/icons-material/Lan';
import MemoryIcon from '@mui/icons-material/Memory';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SdCardIcon from '@mui/icons-material/SdCard';
import SearchIcon from '@mui/icons-material/Search';
import StorageIcon from '@mui/icons-material/Storage';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import styles from './templates-page.module.css';

type HardwareFilter = 'all' | 'gpu' | 'cpu';
type CategoryFilter = 'all' | TemplateCategory;

type Filters = {
  category: CategoryFilter;
  hardware: HardwareFilter;
  query: string;
};

const DEFAULT_FILTERS: Filters = { category: 'all', hardware: 'all', query: '' };

const HARDWARE_SEGMENTS: { key: HardwareFilter; label: string; Icon: typeof MemoryIcon }[] = [
  { key: 'all', label: 'All', Icon: AppsIcon },
  { key: 'gpu', label: 'GPU', Icon: MemoryIcon },
  { key: 'cpu', label: 'CPU', Icon: DeveloperBoardIcon },
];

const HARDWARE_LABEL: Record<Exclude<HardwareFilter, 'all'>, string> = { gpu: 'GPU', cpu: 'CPU' };

/** A template decorated with everything the card renders — all of it derived from the template alone. */
type DecoratedTemplate = {
  tpl: AppTemplate;
  category: TemplateCategory;
  accent: string;
  categoryLabel: string;
  CategoryIcon: (typeof CATEGORY_META)[TemplateCategory]['Icon'];
  mono: string | null;
  logo: string | null;
  name: string;
  vendor: string;
  gpu: boolean;
  port?: number;
  meta: { key: string; Icon: typeof MemoryIcon; label: string }[];
  /** Shown instead of the resource meta when the template declares neither RAM nor disk. */
  metaFallback: string | null;
};

function decorate(tpl: AppTemplate): DecoratedTemplate {
  const visual = visualFor(tpl.id);
  const hw = templateHardware(tpl);
  const port = templatePrimaryPort(tpl);
  const meta: DecoratedTemplate['meta'] = [
    {
      key: 'hw',
      Icon: hw.gpu ? MemoryIcon : DeveloperBoardIcon,
      label: hw.gpu ? `${hw.gpuUnits || 1}× GPU` : 'CPU only',
    },
  ];
  if (hw.ram != null) {
    meta.push({ key: 'ram', Icon: SdCardIcon, label: `${hw.ram} GB RAM` });
  }
  if (hw.disk != null) {
    meta.push({ key: 'disk', Icon: StorageIcon, label: `${hw.disk} GB disk` });
  }
  if (port != null) {
    meta.push({ key: 'port', Icon: LanIcon, label: `port ${port}` });
  }
  return {
    tpl,
    category: visual.category,
    accent: visual.meta.accent,
    categoryLabel: visual.meta.label,
    CategoryIcon: visual.meta.Icon,
    mono: visual.mono,
    logo: templateLogoSrc(tpl.id),
    name: tpl.name ?? tpl.id,
    vendor: templateVendor(tpl.image),
    gpu: hw.gpu,
    port,
    meta,
    metaFallback: hw.ram == null && hw.disk == null ? 'Resources at next step' : null,
  };
}

function matchesQuery(item: DecoratedTemplate, query: string): boolean {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  return `${item.name} ${item.tpl.description ?? ''} ${item.tpl.id}`.toLowerCase().includes(needle);
}

function matchesHardware(item: DecoratedTemplate, hardware: HardwareFilter): boolean {
  return hardware === 'all' || (hardware === 'gpu' ? item.gpu : !item.gpu);
}

/**
 * Templates flow entry: pick a ready-made containerized app (ComfyUI, JupyterLab, …), review it in the
 * details modal, then launch straight onto one of the environments that can run it — or hand off to the
 * full env picker ("Advanced setup"). Filtering is two-axis: category (the primary, data-driven axis, as
 * a wrapping pill row) narrowed by hardware (a fixed triple, as a compact segmented control) plus free
 * text; the active combination lives in the URL so a refresh or a shared link restores it. Templates are
 * served by the node (getServiceTemplates); see useServiceTemplates.
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

  const { templates, loading, error } = useServiceTemplates();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // The template whose details are open. Picking one commits nothing — only a Continue/Advanced does.
  const [openTemplate, setOpenTemplate] = useState<AppTemplate | null>(null);
  // Session length edited in the modal but kept local until a Continue/Advanced handoff.
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the filter combination from the URL once the router is ready (refresh / shared link).
  const filtersHydratedRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || filtersHydratedRef.current) {
      return;
    }
    filtersHydratedRef.current = true;
    const category = firstQueryValue(router.query.category);
    const hardware = firstQueryValue(router.query.hardware);
    setFilters({
      category: CATEGORY_ORDER.includes(category as TemplateCategory) ? (category as TemplateCategory) : 'all',
      hardware: hardware === 'gpu' || hardware === 'cpu' ? hardware : 'all',
      query: firstQueryValue(router.query.q) ?? '',
    });
  }, [router.isReady, router.query.category, router.query.hardware, router.query.q]);

  // Mirror the active combination into the URL (shallow — no data fetching), so the summary line under
  // the toolbar and the address bar always agree and the state survives a reload.
  useEffect(() => {
    if (!router.isReady || !filtersHydratedRef.current) {
      return;
    }
    const query: Record<string, string> = {};
    if (filters.category !== 'all') {
      query.category = filters.category;
    }
    if (filters.hardware !== 'all') {
      query.hardware = filters.hardware;
    }
    if (filters.query) {
      query.q = filters.query;
    }
    const current = { ...router.query } as Record<string, string>;
    if (
      (current.category ?? '') === (query.category ?? '') &&
      (current.hardware ?? '') === (query.hardware ?? '') &&
      (current.q ?? '') === (query.q ?? '')
    ) {
      return;
    }
    router.replace({ pathname: '/inference/templates', query }, undefined, { shallow: true });
    // router is intentionally not a dep: including it re-runs on every query change we just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, router.isReady]);

  const decorated = useMemo(() => templates.map(decorate), [templates]);

  // Each axis counts against the OTHER axis's current result, so a count always answers "how many would
  // I get if I clicked this" rather than "how many exist in total".
  const textPool = useMemo(() => decorated.filter((item) => matchesQuery(item, filters.query)), [decorated, filters.query]);
  const categoryPool = useMemo(
    () => textPool.filter((item) => matchesHardware(item, filters.hardware)),
    [textPool, filters.hardware]
  );
  const hardwarePool = useMemo(
    () => (filters.category === 'all' ? textPool : textPool.filter((item) => item.category === filters.category)),
    [textPool, filters.category]
  );
  const visible = useMemo(
    () => (filters.category === 'all' ? categoryPool : categoryPool.filter((item) => item.category === filters.category)),
    [categoryPool, filters.category]
  );

  const categoryCounts = useMemo(() => {
    const counts = {} as Record<TemplateCategory, number>;
    categoryPool.forEach((item) => {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    });
    return counts;
  }, [categoryPool]);

  const hardwareCount = (key: HardwareFilter) =>
    key === 'all' ? hardwarePool.length : hardwarePool.filter((item) => matchesHardware(item, key)).length;

  const isFiltered = filters.category !== 'all' || filters.hardware !== 'all' || !!filters.query;
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (filters.category !== 'all') {
      parts.push(CATEGORY_META[filters.category].label);
    }
    if (filters.hardware !== 'all') {
      parts.push(HARDWARE_LABEL[filters.hardware]);
    }
    if (filters.query) {
      parts.push(`“${filters.query}”`);
    }
    const lead = parts.length > 0 ? `${parts.join(' · ')} — ` : 'All templates — ';
    return `${lead}${visible.length} of ${templates.length} templates`;
  }, [filters, visible.length, templates.length]);

  const emptyHint = useMemo(() => {
    if (filters.query) {
      const inCategory = filters.category !== 'all' ? ` in ${CATEGORY_META[filters.category].label}` : '';
      const onHardware = filters.hardware !== 'all' ? ` on ${HARDWARE_LABEL[filters.hardware]}` : '';
      return `Nothing matches “${filters.query}”${inCategory}${onHardware}. Try a broader term, or clear the category.`;
    }
    if (filters.category !== 'all' && filters.hardware !== 'all') {
      return `This node publishes no ${CATEGORY_META[filters.category].label} template that runs on ${HARDWARE_LABEL[filters.hardware]}.`;
    }
    if (filters.category !== 'all') {
      return `This node publishes no ${CATEGORY_META[filters.category].label} template right now.`;
    }
    if (filters.hardware !== 'all') {
      return `This node publishes no template that runs on ${HARDWARE_LABEL[filters.hardware]}.`;
    }
    return 'Clear the filters to see the full catalogue.';
  }, [filters]);

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
    router.push({
      pathname: `/inference/templates/${encodeURIComponent(openTemplate.id)}/payment`,
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
      pathname: `/inference/templates/${encodeURIComponent(openTemplate.id)}/resources`,
      query: buildSelectionQuery({ templateId: openTemplate.id, durationSeconds }),
    });
  };

  const renderToolbar = () => (
    <>
      <div className={styles.headerRow}>
        <div className={styles.headerText}>
          <h3>Pick a template</h3>
          <div className="textSecondary">
            Ready-made containerized apps — pick one, review what&apos;s inside, choose an environment, pay and launch.
          </div>
        </div>
        <div className={styles.toolbarControls}>
          <div className={styles.search}>
            <SearchIcon className={styles.searchIcon} />
            <input
              aria-label="Search templates"
              className={styles.searchInput}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="Search templates"
              type="search"
              value={filters.query}
            />
            {filters.query && (
              <button
                aria-label="Clear search"
                className={styles.searchClear}
                onClick={() => setFilters((f) => ({ ...f, query: '' }))}
                type="button"
              >
                <CloseIcon className={styles.searchClearIcon} />
              </button>
            )}
          </div>
          <div aria-label="Filter templates by hardware" className={styles.segmented} role="group">
            {HARDWARE_SEGMENTS.map(({ key, label, Icon }) => {
              const active = filters.hardware === key;
              return (
                <button
                  aria-pressed={active}
                  className={cx(styles.segment, { [styles.segmentActive]: active })}
                  key={key}
                  onClick={() => setFilters((f) => ({ ...f, hardware: key }))}
                  type="button"
                >
                  <Icon className={styles.segmentIcon} />
                  {label}
                  <span className={cx(styles.segmentCount, { [styles.segmentCountActive]: active })}>
                    {hardwareCount(key)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div aria-label="Filter templates by category" className={styles.categoryRow} role="group">
        {(['all', ...CATEGORY_ORDER] as CategoryFilter[]).map((key) => {
          const active = filters.category === key;
          const meta = key === 'all' ? null : CATEGORY_META[key];
          const count = key === 'all' ? categoryPool.length : (categoryCounts[key] ?? 0);
          return (
            <button
              aria-pressed={active}
              className={cx(styles.categoryPill, {
                [styles.categoryPillActive]: active,
                [styles.categoryPillEmpty]: count === 0 && !active,
              })}
              key={key}
              onClick={() => setFilters((f) => ({ ...f, category: key }))}
              style={{ '--accent': meta?.accent ?? 'var(--accent1)' } as CSSProperties}
              type="button"
            >
              <span
                className={cx(styles.categoryDot, {
                  [styles.categoryDotAll]: key === 'all' && !active,
                  [styles.categoryDotActive]: active,
                })}
              />
              {meta?.label ?? 'All templates'}
              <span className={cx(styles.categoryCount, { [styles.categoryCountActive]: active })}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.summaryRow}>
        <div className={styles.summary}>
          <FilterAltIcon className={styles.summaryIcon} />
          {summary}
        </div>
        {isFiltered && (
          <button className={styles.resetButton} onClick={resetFilters} type="button">
            <RestartAltIcon className={styles.resetIcon} />
            Reset filters
          </button>
        )}
      </div>
    </>
  );

  // Toolbar counts are meaningless before the catalogue lands, so the loading state renders the header
  // with shimmering stand-ins for the controls and keeps the grid's rhythm with skeleton cards.
  const renderLoading = () => (
    <>
      <div className={styles.headerRow}>
        <div className={styles.headerText}>
          <h3>Pick a template</h3>
          <div className="textSecondary">
            Ready-made containerized apps — pick one, review what&apos;s inside, choose an environment, pay and launch.
          </div>
        </div>
        <div className={styles.skeletonToolbar}>
          <div className={styles.shimmer} style={{ height: 36, width: 210, borderRadius: 24 }} />
          <div className={styles.shimmer} style={{ height: 36, width: 200, borderRadius: 100 }} />
        </div>
      </div>
      <div className={styles.skeletonPills}>
        {[92, 118, 104, 112, 96, 108].map((width) => (
          <div className={styles.shimmer} key={width} style={{ height: 32, width, borderRadius: 100 }} />
        ))}
      </div>
      <div className={styles.grid}>
        {[
          ['70%', '80%'],
          ['86%', '58%'],
          ['62%', '74%'],
          ['78%', '66%'],
          ['66%', '84%'],
          ['82%', '60%'],
        ].map(([first, second]) => (
          <div className={styles.skeletonCard} key={`${first}-${second}`}>
            <div className={styles.skeletonCardTop}>
              <div className={styles.shimmer} style={{ height: 38, width: 38, flex: '0 0 38px', borderRadius: 12 }} />
              <div className={styles.skeletonLines}>
                <div className={styles.shimmer} style={{ height: 12, width: first }} />
                <div className={cx(styles.shimmer, styles.shimmerSoft)} style={{ height: 9, width: 64 }} />
              </div>
            </div>
            <div className={cx(styles.shimmer, styles.shimmerSoft)} style={{ height: 9 }} />
            <div className={cx(styles.shimmer, styles.shimmerSoft)} style={{ height: 9, width: second }} />
            <div className={styles.skeletonChips}>
              <div className={styles.shimmer} style={{ height: 22, width: 58, borderRadius: 16 }} />
              <div className={cx(styles.shimmer, styles.shimmerSoft)} style={{ height: 22, width: 78, borderRadius: 16 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const renderCard = (item: DecoratedTemplate) => (
    <button
      aria-label={`Open details for ${item.name}, ${item.categoryLabel}, ${item.gpu ? 'GPU' : 'CPU'}`}
      className={styles.card}
      key={item.tpl.id}
      onClick={() => openDetails(item.tpl)}
      style={{ '--accent': item.accent } as CSSProperties}
      type="button"
    >
      <div className={styles.cardTop}>
        <span className={styles.tile}>
          {item.mono ? <span className={styles.tileMono}>{item.mono}</span> : <item.CategoryIcon className={styles.tileIcon} />}
          {item.logo && <img alt="" className={styles.tileLogo} src={item.logo} />}
        </span>
        <span className={styles.titleWrap}>
          <span className={styles.name} title={item.name}>
            {item.name}
          </span>
          <span className={styles.vendor} title={item.tpl.image}>
            {item.vendor}
          </span>
        </span>
        <span className={styles.cta}>
          Details
          <ArrowForwardIcon className={styles.ctaIcon} />
        </span>
      </div>

      <p className={cx(styles.desc, { [styles.descEmpty]: !item.tpl.description })}>
        {item.tpl.description || 'No description published for this image.'}
      </p>

      <div className={styles.chips}>
        <span className={styles.cardChip}>{item.categoryLabel}</span>
        <span className={styles.cardChip}>{item.gpu ? 'GPU' : 'CPU'}</span>
        {item.port != null && <span className={cx(styles.cardChip, styles.cardChipHighlight)}>Web UI</span>}
      </div>

      <div className={styles.metaRow}>
        {item.meta.map(({ key, Icon, label }) => (
          <span className={styles.meta} key={key}>
            <Icon className={styles.metaIcon} />
            {label}
          </span>
        ))}
        {item.metaFallback && <span className={styles.metaFallback}>{item.metaFallback}</span>}
      </div>
    </button>
  );

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch an app on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="template" flowType={InferenceFlowType.Template} />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          {loading ? (
            renderLoading()
          ) : error ? (
            <div className={cx(styles.stateBox, 'textErrorDarker')}>{error}</div>
          ) : decorated.length === 0 ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>No templates available.</div>
          ) : (
            <>
              {renderToolbar()}
              {visible.length > 0 ? (
                <div className={styles.grid}>{visible.map(renderCard)}</div>
              ) : (
                <div className={styles.emptyState}>
                  <FilterAltOffIcon className={styles.emptyIcon} />
                  <div className={styles.emptyTitle}>No templates match these filters</div>
                  <div className={styles.emptyHint}>{emptyHint}</div>
                  <button
                    className={cx(styles.resetButton, styles.resetButtonPrimary)}
                    onClick={resetFilters}
                    type="button"
                  >
                    <RestartAltIcon className={styles.resetIcon} />
                    Reset filters
                  </button>
                </div>
              )}
            </>
          )}
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

export default TemplatesPage;
