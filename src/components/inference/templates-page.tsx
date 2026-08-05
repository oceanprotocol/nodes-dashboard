import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import useTemplateEnvs, { ResolvedTemplateEnv } from '@/components/hooks/use-template-envs';
import TemplateCard from '@/components/inference/template-card';
import InferenceStepper from '@/components/inference/inference-stepper';
import TemplateDetailsModal from '@/components/inference/template-details-modal';
import Input from '@/components/input/input';
import SectionTitle from '@/components/section-title/section-title';
import { DEFAULT_JOB_DURATION_SECONDS, useInferenceContext } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { firstQueryValue } from '@/services/inference-url';
import { BundleGroup, groupBundlesByService } from '@/services/service-templates';
import { templatePinnedSizing } from '@/services/template-launch';
import { InferenceFlowType } from '@/types/inference';
import { AppBundle, requiredEnvVars } from '@/types/templates';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './templates-page.module.css';

/** Free-text match across everything a bundle is browsed by — outcome first, then app and contents. */
function matchesQuery(bundle: AppBundle, serviceName: string, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    bundle.outcome ?? '',
    bundle.name ?? '',
    bundle.description ?? '',
    bundle.id,
    serviceName,
    ...(bundle.includes ?? []).map((i) => `${i.name} ${i.repoId ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function filterGroups(groups: BundleGroup[], query: string): BundleGroup[] {
  if (!query) {
    return groups;
  }
  return groups
    .map((group) => ({
      ...group,
      bundles: group.bundles.filter((bundle) => matchesQuery(bundle, group.serviceName, query)),
    }))
    .filter((group) => group.bundles.length > 0);
}

/**
 * Bundles flow entry: a bundle is a service whose `command` pre-downloads a curated model set, so it
 * is usable the moment it opens. Sections are scoped per service (the `service` field on each bundle),
 * and cards lead with the `outcome` so the page can be browsed by what you want done rather than by
 * which app does it. Search spans outcome, app and contents for the same reason.
 *
 * Picking one opens the SAME details modal the services catalogue uses, and launching goes through the
 * SAME wizard (`/inference/services/[id]/…`) — a bundle is a template, so there is one launch path.
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
  const [query, setQuery] = useState('');
  // The bundle whose details are open. Picking one commits nothing — only a Continue/Advanced does.
  const [openBundle, setOpenBundle] = useState<AppBundle | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_JOB_DURATION_SECONDS);

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the search from the URL once (refresh / shared link), then mirror it back shallowly.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || hydratedRef.current) {
      return;
    }
    hydratedRef.current = true;
    setQuery(firstQueryValue(router.query.q) ?? '');
  }, [router.isReady, router.query.q]);

  useEffect(() => {
    if (!router.isReady || !hydratedRef.current) {
      return;
    }
    const current = firstQueryValue(router.query.q) ?? '';
    if (current === query) {
      return;
    }
    router.replace({ pathname: '/inference/templates', query: query ? { q: query } : {} }, undefined, {
      shallow: true,
    });
    // router is intentionally not a dep: including it re-runs on every query change we just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, router.isReady]);

  const groups = useMemo(() => groupBundlesByService(templates), [templates]);
  const visibleGroups = useMemo(() => filterGroups(groups, query), [groups, query]);
  const totalBundles = useMemo(() => groups.reduce((sum, g) => sum + g.bundles.length, 0), [groups]);
  const visibleBundles = useMemo(
    () => visibleGroups.reduce((sum, g) => sum + g.bundles.length, 0),
    [visibleGroups]
  );

  const templateEnvs = useTemplateEnvs(openBundle);

  const openDetails = (bundle: AppBundle) => {
    setOpenBundle(bundle);
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

  const renderBody = () => {
    if (loading) {
      return (
        <div className={styles.grid}>
          {[68, 82, 74, 88].map((width) => (
            <div className={styles.skeletonCard} key={width}>
              <div className={styles.skeletonTop}>
                <div className="shimmer" style={{ height: 38, width: 38, flex: '0 0 38px', borderRadius: 12 }} />
                <div className={styles.skeletonLines}>
                  <div className="shimmer" style={{ height: 12, width: `${width}%` }} />
                  <div className="shimmer shimmerSoft" style={{ height: 9, width: 72 }} />
                </div>
              </div>
              <div className="shimmer shimmerSoft" style={{ height: 64, borderRadius: 12 }} />
            </div>
          ))}
        </div>
      );
    }
    if (error) {
      return <div className={cx(styles.stateBox, 'textErrorDarker')}>{error}</div>;
    }
    // Nothing published: this node advertises services but no bundles (or no templates at all). Say so
    // and point at the catalogue that does have something, rather than showing an empty grid.
    if (totalBundles === 0) {
      return (
        <div className={styles.emptyState}>
          <Inventory2OutlinedIcon className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No templates on this node yet</div>
          <div className={styles.emptyHint}>
            Templates are published by the node you&apos;re connected to. This one advertises none right now — you can
            still start any service and add models from its own UI.
          </div>
          <Button
            className={styles.emptyAction}
            color="accent1"
            contentAfter={<ArrowForwardIcon />}
            href="/inference/services"
            size="sm"
          >
            Browse services
          </Button>
        </div>
      );
    }
    if (visibleBundles === 0) {
      return (
        <div className={styles.emptyState}>
          <FilterAltOffIcon className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No template matches “{query}”</div>
          <div className={styles.emptyHint}>Try a broader term — search covers the outcome, the app and the models.</div>
          <Button className={styles.emptyAction} color="accent1" onClick={() => setQuery('')} size="sm" variant="outlined">
            Clear search
          </Button>
        </div>
      );
    }
    return (
      <>
        {visibleGroups.map((group) => (
          <section className={styles.group} key={group.serviceId}>
            <div className={styles.groupHead}>
              <h4 className={styles.groupTitle}>{group.serviceName}</h4>
              <span className={styles.groupCount}>
                {group.bundles.length} {group.bundles.length === 1 ? 'template' : 'templates'}
              </span>
              {/* A node may publish a bundle without the bare service it is a variant of — the bundle
                  still launches, there is just nothing to link to for "start it empty". */}
              {group.service && (
                <Button
                  className={styles.groupLink}
                  color="accent1"
                  href={`/inference/services?q=${encodeURIComponent(group.serviceId)}`}
                  size="xs"
                  variant="transparent"
                >
                  Start it empty
                </Button>
              )}
            </div>
            <div className={styles.grid}>
              {group.bundles.map((bundle) => (
                <TemplateCard bundle={bundle} key={bundle.id} onOpen={openDetails} serviceName={group.serviceName} />
              ))}
            </div>
          </section>
        ))}
      </>
    );
  };

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch an app on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="template" flowType={InferenceFlowType.Template} kindLabel="Template" />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <div className={styles.headerRow}>
            <div className={styles.headerText}>
              <h3>Pick a template</h3>
              <div className="textSecondary">
                An app with its models already included — pick what you want to get done and launch. The models
                download in the background while the app comes up.
              </div>
            </div>
            <Input
              className={styles.search}
              endAdornment={
                query ? (
                  <Button color="primary" onClick={() => setQuery('')} size="sm-const" variant="transparent">
                    <CloseIcon aria-label="Clear search" className={styles.searchClearIcon} role="img" />
                  </Button>
                ) : null
              }
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates"
              size="sm"
              startAdornment={<SearchIcon className={styles.searchIcon} />}
              type="text"
              value={query}
            />
          </div>
          {!loading && !error && totalBundles > 0 && (
            <div className={styles.summary}>
              {query ? `“${query}” — ${visibleBundles} of ${totalBundles} templates` : `${totalBundles} templates`}
            </div>
          )}
          {renderBody()}
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
