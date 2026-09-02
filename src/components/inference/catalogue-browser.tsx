import GpuIcon from '@/assets/icons/gpu.svg';
import Button from '@/components/button/button';
import { CatalogueCopy } from '@/components/inference/catalogue-config';
import CatalogueSkeleton from '@/components/inference/catalogue-skeleton';
import TemplateCard, { decorate, DecoratedTemplate } from '@/components/inference/template-card';
import { accentVars, CATEGORY_META, CATEGORY_ORDER, TemplateCategory } from '@/components/inference/template-visual';
import Input from '@/components/input/input';
import { useTheme } from '@/lib/use-theme';
import { firstQueryValue } from '@/services/inference-url';
import { AppTemplate } from '@/types/templates';
import AppsIcon from '@mui/icons-material/Apps';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import MemoryIcon from '@mui/icons-material/Memory';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import styles from './catalogue.module.css';

type HardwareFilter = 'all' | 'gpu' | 'cpu';
type CategoryFilter = 'all' | TemplateCategory;

type Filters = {
  category: CategoryFilter;
  hardware: HardwareFilter;
  query: string;
};

const DEFAULT_FILTERS: Filters = { category: 'all', hardware: 'all', query: '' };

// Icons match the environment cards: generic GPU glyph for GPU, chip/memory glyph for CPU.
const HARDWARE_SEGMENTS: {
  key: HardwareFilter;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'all', label: 'All', Icon: AppsIcon },
  { key: 'gpu', label: 'GPU', Icon: GpuIcon },
  { key: 'cpu', label: 'CPU', Icon: MemoryIcon },
];

const HARDWARE_LABEL: Record<Exclude<HardwareFilter, 'all'>, string> = { gpu: 'GPU', cpu: 'CPU' };

/**
 * Free text matches everything an entry is browsed by. `outcome` and the included models are only set
 * on bundles, so a bare service simply matches on fewer fields — no separate search per catalogue.
 */
function matchesQuery(item: DecoratedTemplate, query: string): boolean {
  if (!query) {
    return true;
  }
  const { tpl } = item;
  const haystack = [
    tpl.outcome ?? '',
    item.name,
    tpl.description ?? '',
    tpl.id,
    ...(tpl.includes ?? []).map((i) => `${i.name} ${i.repoId ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function matchesHardware(item: DecoratedTemplate, hardware: HardwareFilter): boolean {
  return hardware === 'all' || (hardware === 'gpu' ? item.gpu : !item.gpu);
}

type CatalogueBrowserProps = {
  /** Entries to browse — already narrowed to one catalogue (see CatalogueConfig.select). */
  items: AppTemplate[];
  loading: boolean;
  error: string | null;
  onOpen: (tpl: AppTemplate) => void;
  /** Everything this catalogue is called, plus the route the filters are mirrored into. */
  copy: CatalogueCopy;
};

/**
 * The catalogue UI shared by both catalogue pages: two-axis filtering — category (the primary,
 * data-driven axis, as a wrapping pill row) narrowed by hardware (a fixed triple, as a compact
 * segmented control) plus free text — over a grid of cards, with the active combination mirrored into
 * the URL. Each axis counts against the OTHER axis's current result, so a count always answers "how
 * many would I get if I clicked this" rather than "how many exist".
 *
 * Selecting a card commits nothing — the page owns the details modal and launch.
 */
const CatalogueBrowser: React.FC<CatalogueBrowserProps> = ({ items, loading, error, onOpen, copy }) => {
  const { heading, lead, noun, nounPlural, searchPlaceholder, pathname, empty } = copy;
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

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
    router.replace({ pathname, query }, undefined, { shallow: true });
    // router is intentionally not a dep: including it re-runs on every query change we just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, router.isReady, pathname]);

  const decorated = useMemo(() => items.map(decorate), [items]);

  const textPool = useMemo(
    () => decorated.filter((item) => matchesQuery(item, filters.query)),
    [decorated, filters.query]
  );
  const categoryPool = useMemo(
    () => textPool.filter((item) => matchesHardware(item, filters.hardware)),
    [textPool, filters.hardware]
  );
  const hardwarePool = useMemo(
    () => (filters.category === 'all' ? textPool : textPool.filter((item) => item.category === filters.category)),
    [textPool, filters.category]
  );
  const visible = useMemo(
    () =>
      filters.category === 'all' ? categoryPool : categoryPool.filter((item) => item.category === filters.category),
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
    const lead = parts.length > 0 ? `${parts.join(' · ')} — ` : `All ${nounPlural} — `;
    return `${lead}${visible.length} of ${decorated.length} ${nounPlural}`;
  }, [filters, visible.length, decorated.length, nounPlural]);

  const emptyHint = useMemo(() => {
    if (filters.query) {
      const inCategory = filters.category !== 'all' ? ` in ${CATEGORY_META[filters.category].label}` : '';
      const onHardware = filters.hardware !== 'all' ? ` on ${HARDWARE_LABEL[filters.hardware]}` : '';
      return `Nothing matches “${filters.query}”${inCategory}${onHardware}. Try a broader term, or clear the category.`;
    }
    if (filters.category !== 'all' && filters.hardware !== 'all') {
      return `No ${CATEGORY_META[filters.category].label} ${noun} that runs on ${HARDWARE_LABEL[filters.hardware]} is available right now.`;
    }
    if (filters.category !== 'all') {
      return `No ${CATEGORY_META[filters.category].label} ${noun} is available right now.`;
    }
    if (filters.hardware !== 'all') {
      return `No ${noun} that runs on ${HARDWARE_LABEL[filters.hardware]} is available right now.`;
    }
    return 'Clear the filters to see the full catalogue.';
  }, [filters, noun]);

  const renderHeaderText = () => (
    <div className={styles.headerText}>
      <h3>{heading}</h3>
      <div className="textSecondary">{lead}</div>
    </div>
  );

  const renderToolbar = () => (
    <>
      <div className={styles.headerRow}>
        {renderHeaderText()}
        <div className={styles.toolbarControls}>
          <Input
            className={styles.search}
            endAdornment={
              filters.query ? (
                <Button
                  color="primary"
                  onClick={() => setFilters((f) => ({ ...f, query: '' }))}
                  size="sm-const"
                  variant="transparent"
                >
                  <CloseIcon aria-label="Clear search" className={styles.searchClearIcon} role="img" />
                </Button>
              ) : null
            }
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            placeholder={searchPlaceholder}
            size="sm"
            startAdornment={<SearchIcon className={styles.searchIcon} />}
            type="text"
            value={filters.query}
          />
          <div aria-label={`Filter ${nounPlural} by hardware`} className={styles.segmented} role="group">
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

      <div aria-label={`Filter ${nounPlural} by category`} className={styles.categoryRow} role="group">
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
              style={
                (meta ? accentVars(meta.accent, resolvedTheme) : { '--accent': 'var(--accent1)' }) as CSSProperties
              }
              type="button"
            >
              <span
                className={cx(styles.categoryDot, {
                  [styles.categoryDotAll]: key === 'all' && !active,
                  [styles.categoryDotActive]: active,
                })}
              />
              {meta?.label ?? `All ${nounPlural}`}
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
          <Button
            color="accent1"
            contentBefore={<RestartAltIcon fontSize="small" />}
            onClick={resetFilters}
            size="xs"
            variant="outlined"
          >
            Reset filters
          </Button>
        )}
      </div>
    </>
  );

  if (loading) {
    return <CatalogueSkeleton header={renderHeaderText()} />;
  }
  if (error) {
    return <div className={cx(styles.stateBox, 'textErrorDarker')}>{error}</div>;
  }
  if (decorated.length === 0) {
    return <>{empty}</>;
  }

  return (
    <>
      {renderToolbar()}
      {visible.length > 0 ? (
        <div className={styles.grid}>
          {visible.map((item) => (
            <TemplateCard item={item} key={item.tpl.id} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <FilterAltOffIcon className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No {nounPlural} match these filters</div>
          <div className={styles.emptyHint}>{emptyHint}</div>
          <Button
            className={styles.emptyReset}
            color="accent1"
            contentBefore={<RestartAltIcon fontSize="small" />}
            onClick={resetFilters}
            size="sm"
          >
            Reset filters
          </Button>
        </div>
      )}
    </>
  );
};

export default CatalogueBrowser;
