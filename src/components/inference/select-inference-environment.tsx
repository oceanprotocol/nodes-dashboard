import Button from '@/components/button/button';
import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import useCustomModelSizing from '@/components/hooks/use-custom-model-sizing';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import CustomModelSizingPanel, {
  ContextChoice,
  CustomModelSizingPanelHandle,
  FitSummary,
  formatTokensShort,
  NoFitCard,
  SizingLayout,
} from '@/components/inference/custom-model-sizing-panel';
import DeclaredResources from '@/components/inference/declared-resources';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import SettingsSection from '@/components/inference/settings-section';
import DurationInput from '@/components/input/duration-input';
import Select from '@/components/input/select';
import TabBar from '@/components/tab-bar/tab-bar';
import { isInferenceNode } from '@/constants/nodes';
import { useInferenceContext } from '@/context/inference-context';
import { DEFAULT_FILTERS, RawFilters, useRunJobEnvsContext } from '@/context/run-job-envs-context';
import { captureError } from '@/lib/analytics';
import { resolveInferenceBranch } from '@/lib/inference-analytics';
import {
  FALLBACK_CONTEXT_TOKENS,
  SIZING_CONTEXT_OPTIONS,
  SIZING_CONTEXT_QUERY_KEY,
  sizingContextFromQuery,
} from '@/services/vram-estimate';
import { ComputeEnvironment, ComputeResource, NodeEnvironments } from '@/types/environments';
import { InferenceFlowType } from '@/types/inference';
import { DURATION_UNIT_OPTIONS, formatSessionEnd } from '@/utils/duration';
import {
  demandOf,
  GpuDemand,
  gpuGroupKey,
  GpuPlan,
  isBenchmarkEnv,
  isGpuResource,
  layoutCardGb,
  planGpuDemand,
} from '@/utils/env-resources';
import { acceptsUsdc, getEnvUsdcFees } from '@/utils/env-tokens';
import { formatDuration } from '@/utils/formatters';
import { serviceDurationBounds } from '@/utils/service-duration';
import FilterListIcon from '@mui/icons-material/FilterList';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { grantableAmount, type TemplateResourceRequirement } from '@oceanprotocol/lib';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './select-inference-environment.module.css';

const DEFAULT_CONTEXT_OPTION = 'default';

/** Paid service-on-demand duration bounds for an env. Inference always uses a paid token, so the
 *  top-level bounds apply (not the `free.*` ones). */
function durationBounds(env: ComputeEnvironment): { min: number; max: number } {
  return serviceDurationBounds(env);
}

/** An env is bookable for inference when its node is on the inference allowlist and it (a) advertises
 *  service-on-demand support — the node rejects serviceStart with 403 otherwise — (b) isn't the node's
 *  own benchmark environment, and (c) accepts USDC. */
function isBookableEnv(env: ComputeEnvironment, node: NodeEnvironments): boolean {
  // TODO: remove this allowlist once community nodes are allowed to run inference services. Dropping
  // this check is all that's needed here — the three tests below are capability tests, not policy.
  // See ON_INFERENCE_NODES.
  if (!isInferenceNode(node.id)) {
    return false;
  }
  if (!env.features?.services) {
    return false;
  }
  if (isBenchmarkEnv(env)) {
    return false;
  }
  return acceptsUsdc(env);
}

/** Resource/GPU/price shape captured on the inference analytics events. */
export type InferenceSelectionEstimate = {
  cpu: number;
  ram: number;
  disk: number;
  gpuCount: number;
  gpuTypes: string[];
  price: number;
};

/** Analytics-only approximation of the picked env's shared resources, GPU types, and price for the
 *  chosen GPU selection/duration. Not the constraint-aware allocation (@/components/hooks/use-
 *  inference-allocation) used to actually book the job — a rough estimate is fine for a capture prop. */
export function estimateSelectionForAnalytics(
  environment: ComputeEnvironment,
  gpuSelection: GpuSelection,
  durationSeconds: number
): InferenceSelectionEstimate {
  const resources = environment.resources ?? [];
  const cpu = resources.find((res) => res.type === 'cpu' || res.id === 'cpu');
  const ram = resources.find((res) => res.type === 'ram' || res.id === 'ram');
  const disk = resources.find((res) => res.type === 'disk' || res.id === 'disk');
  const gpus = resources.filter(isGpuResource);

  const gpuByDescription = new Map<string, ComputeResource[]>();
  gpus.forEach((gpu) => {
    const key = gpuGroupKey(gpu);
    gpuByDescription.set(key, [...(gpuByDescription.get(key) ?? []), gpu]);
  });

  const prices = getEnvUsdcFees(environment.fees)?.prices;
  const priceFor = (id: string) => prices?.find((p) => p.id === id)?.price ?? 0;

  let gpuCount = 0;
  let gpuPrice = 0;
  const gpuTypes: string[] = [];
  gpuByDescription.forEach((entries, key) => {
    const requested = gpuSelection[key];
    const available = entries.reduce((sum, entry) => sum + grantableAmount(entry), 0);
    const units = requested === undefined ? available : Math.min(Math.max(requested, 0), available);
    if (units > 0) {
      gpuCount += units;
      gpuTypes.push(key);
    }
    // Price the same clamped quantity that `gpuCount` reports, spread over the group's entries in
    // order — several entries can share a description, and each has its own price id.
    let left = units;
    entries.forEach((entry) => {
      const take = Math.min(left, grantableAmount(entry));
      gpuPrice += priceFor(entry.id) * take;
      left -= take;
    });
  });

  const cpuAmount = cpu ? grantableAmount(cpu) : 0;
  const ramAmount = ram ? grantableAmount(ram) : 0;
  const diskAmount = disk ? grantableAmount(disk) : 0;
  const minutes = durationSeconds / 60;
  const price =
    (priceFor('cpu') * cpuAmount + priceFor('ram') * ramAmount + priceFor('disk') * diskAmount + gpuPrice) * minutes;

  return { cpu: cpuAmount, ram: ramAmount, disk: diskAmount, gpuCount, gpuTypes, price };
}

const sortOptions = [
  { label: 'Best score', value: JSON.stringify({ benchmarkTotalScore: 'desc' }) },
  { label: 'Cheapest', value: JSON.stringify({ price: 'asc' }) },
  { label: 'Most expensive', value: JSON.stringify({ price: 'desc' }) },
];

const DURATION_PRESETS = [
  { label: '30 min', seconds: 1800 },
  { label: '1 hour', seconds: 3600 },
  { label: '2 hours', seconds: 7200 },
  { label: '4 hours', seconds: 14400 },
  { label: '8 hours', seconds: 28800 },
];

type FilterFormValues = {
  gpuName: string[];
  sortBy: string;
};

type SelectInferenceEnvironmentProps = {
  /** Fired after an environment/gpu pick is committed to context. Receives the freshly-picked
   *  values so the caller can navigate with them without waiting for context state to settle. */
  onEnvSelected: (
    picked: { peerId: string; envId: string; gpuSelection: GpuSelection; gpuPlan: GpuPlan },
    /** Resources/GPU of the pick itself — context hasn't settled yet, so the caller cannot derive these. */
    estimate: InferenceSelectionEstimate
  ) => void;
  /** Which flow is using the picker — tags the analytics events with the right branch. */
  flowType: InferenceFlowType;
  /**
   * The recommended resources of the template or package being launched, shown above the list. Left
   * out of a custom-model flow started from the model picker, which has none.
   */
  declaredResources?: TemplateResourceRequirement[];
  /** Offer only the layout of this many cards — a handed-off package's pinned tensor-parallel width. */
  forcedGpuCount?: number;
};

const SelectInferenceEnvironment: React.FC<SelectInferenceEnvironmentProps> = ({
  onEnvSelected,
  flowType,
  declaredResources,
  forcedGpuCount,
}) => {
  const { loading, loadMoreEnvs, nodeEnvs, paginationResponse, filters, setFilters, setSort, sort } =
    useRunJobEnvsContext();
  const {
    jobDurationSeconds,
    setJobDurationSeconds,
    setSelectedEnv,
    selectedEnv,
    selectedTemplate,
    selectedModels,
    modelParamsByModel,
    engine,
    hfToken,
  } = useInferenceContext();

  /*
   * A hand-picked custom model declares nothing, so its constraints are derived here (the flow is capped
   * at one model): the tensor-parallel widths its attention heads allow — a HARD filter, an illegal count
   * (e.g. 3 on a 32-head model) is never offered — and an estimated VRAM requirement for its launch
   * settings, also HARD, as a template's recommendation is: environments and layouts that can't hold it
   * are not listed. The estimate is sized for the context the user picks here (the `ctx` query param,
   * default the model's own maximum), since the KV cache at full context is often most of it; the
   * config step pre-fills Max context with that choice. Unused once a template or package declares a
   * recommendation.
   */
  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel && !declaredResources;
  const customModel = isCustomModelFlow ? selectedModels[0] : undefined;
  const customModelParams = customModel ? modelParamsByModel[customModel.id] : undefined;
  const router = useRouter();
  const sizingContext = sizingContextFromQuery(router.query[SIZING_CONTEXT_QUERY_KEY]);
  const {
    loading: sizingLoading,
    sizing: customSizing,
    modelMaxContext,
  } = useCustomModelSizing({
    enabled: isCustomModelFlow,
    model: customModel,
    engine,
    params: customModelParams,
    contextTokens: sizingContext,
    hfToken,
  });
  const savedContext =
    customModelParams?.engine === 'vllm' && customModelParams.maxContext && customModelParams.maxContext > 0
      ? customModelParams.maxContext
      : null;
  // The default choice (no `ctx`) sizes for the committed Max context when there is one, else the model's own.
  const defaultChoice: ContextChoice = savedContext
    ? { value: DEFAULT_CONTEXT_OPTION, label: formatTokensShort(savedContext), suffix: 'saved' }
    : modelMaxContext
      ? { value: DEFAULT_CONTEXT_OPTION, label: formatTokensShort(modelMaxContext), suffix: 'max' }
      : { value: DEFAULT_CONTEXT_OPTION, label: 'Max' };
  // Keep a context restored from the URL visible even when it isn't one of the presets.
  const contextOptions = useMemo(() => {
    const below = SIZING_CONTEXT_OPTIONS.filter((tokens) => modelMaxContext === null || tokens < modelMaxContext);
    return sizingContext !== null && !below.includes(sizingContext) ? [...below, sizingContext] : below;
  }, [modelMaxContext, sizingContext]);
  // No context to choose from: neither the model nor the committed params name one, so the estimate sizes
  // the fallback (or a context the URL already carries) and the control only says which.
  const contextUnknown = !sizingLoading && !!customSizing && modelMaxContext === null && savedContext === null;
  const contextChoices = useMemo<ContextChoice[]>(
    () =>
      contextUnknown
        ? [
            sizingContext !== null
              ? { value: String(sizingContext), label: formatTokensShort(sizingContext) }
              : { value: DEFAULT_CONTEXT_OPTION, label: formatTokensShort(FALLBACK_CONTEXT_TOKENS), suffix: 'assumed' },
          ]
        : [
            defaultChoice,
            ...contextOptions.map((tokens) => ({ value: String(tokens), label: formatTokensShort(tokens) })),
          ],
    // defaultChoice is derived from the values listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextUnknown, sizingContext, contextOptions, savedContext, modelMaxContext]
  );
  /** The context the estimate is sized for, as the list header and empty state name it. */
  const sizedContextLabel = formatTokensShort(
    sizingContext ?? savedContext ?? modelMaxContext ?? FALLBACK_CONTEXT_TOKENS
  );
  const sizingRequirement = customSizing?.requirement;
  const sizingLayouts = useMemo<SizingLayout[] | null>(
    () =>
      sizingRequirement
        ? (sizingRequirement.layouts ?? []).flatMap((layout) => {
            const gb = layoutCardGb(sizingRequirement, layout);
            return gb === undefined ? [] : [{ gpus: layout.gpuCount, gbPerGpu: Math.round(gb) }];
          })
        : null,
    [sizingRequirement]
  );
  const sizingPanelRef = useRef<CustomModelSizingPanelHandle>(null);
  const onSizingContextChange = (value: string) => {
    const { [SIZING_CONTEXT_QUERY_KEY]: _dropped, ...rest } = router.query;
    // Shallow: the URL carries the choice to the config step (and across a refresh); `ctx` is not part
    // of the hydration signature, so this doesn't re-resolve the selection.
    router.replace(
      { query: value === DEFAULT_CONTEXT_OPTION ? rest : { ...rest, [SIZING_CONTEXT_QUERY_KEY]: value } },
      undefined,
      { shallow: true, scroll: false }
    );
  };
  const [durationDraft, setDurationDraft] = useState(jobDurationSeconds);
  const [durationTouched, setDurationTouched] = useState(false);
  const [durationSource, setDurationSource] = useState<'preset' | 'custom'>(() =>
    DURATION_PRESETS.some((preset) => preset.seconds === jobDurationSeconds) ? 'preset' : 'custom'
  );
  const durationError = !Number.isFinite(durationDraft) || durationDraft < 1 ? 'Enter a length above zero.' : undefined;
  const gpuDemand = useMemo<GpuDemand | undefined>(() => {
    if (!isCustomModelFlow || !customSizing) {
      return undefined;
    }
    return customSizing.requirement
      ? { kind: 'vram', requirement: customSizing.requirement }
      : { kind: 'units', widths: customSizing.widths };
  }, [isCustomModelFlow, customSizing]);
  // What the listed envs must satisfy: the custom-model estimate (`gpuDemand`) when the flow has one,
  // otherwise the template/package declared VRAM requirement. A `none` demand fits every env.
  const listDemand = useMemo<GpuDemand>(() => gpuDemand ?? demandOf(declaredResources), [gpuDemand, declaredResources]);
  /** Hidden by the memory filter: no GPU group here could ever hold the recommended/estimated VRAM. */
  const fitsDemand = useMemo(() => {
    if (listDemand.kind !== 'vram') {
      return () => true;
    }
    return (env: ComputeEnvironment) =>
      planGpuDemand({ environment: env, demand: listDemand, assumeAllFree: true }).length > 0;
  }, [listDemand]);

  const branch = useMemo(() => resolveInferenceBranch(flowType, selectedTemplate), [flowType, selectedTemplate]);

  const gpuOptions = process.env.NEXT_PUBLIC_GPU_LIST?.split(',').map((gpu) => ({ value: gpu, label: gpu })) ?? [];

  const [filterValues, setFilterValues] = useState<FilterFormValues>({
    gpuName: filters.gpuName ?? [],
    sortBy: sort ?? '',
  });

  const onFilterChange = (e: { target: { name: string; value: unknown } }) => {
    const values = { ...filterValues, [e.target.name]: e.target.value };
    setFilterValues(values);
    const next: RawFilters = { ...DEFAULT_FILTERS };
    if (values.gpuName.length > 0) {
      next.gpuName = values.gpuName;
    }
    setFilters(next);
    setSort(values.sortBy);
  };

  const isListedEnv = useMemo(
    () => (env: ComputeEnvironment, node: NodeEnvironments) => isBookableEnv(env, node) && fitsDemand(env),
    [fitsDemand]
  );

  const filteredNodeEnvs = useMemo(() => {
    const result: NodeEnvironments[] = [];
    nodeEnvs.forEach((nodeEnv) => {
      // Explicit callback rather than passing `isListedEnv` straight to `filter` — its second
      // parameter is the owning node, not Array#filter's index.
      const filteredEnvs = nodeEnv.computeEnvironments.environments.filter((env) => isListedEnv(env, nodeEnv));
      if (filteredEnvs.length > 0) {
        result.push({
          ...nodeEnv,
          computeEnvironments: { ...nodeEnv.computeEnvironments, environments: filteredEnvs },
        });
      }
    });
    return result;
  }, [nodeEnvs, isListedEnv]);

  const listedEnvCount = filteredNodeEnvs.reduce((sum, node) => sum + node.computeEnvironments.environments.length, 0);
  /** The custom-model estimate is in and nothing listed holds it: the empty state points at the context. */
  const noEnvFitsEstimate =
    isCustomModelFlow && !!sizingRequirement && !sizingLoading && !loading && listedEnvCount === 0;
  /** GPU counts an environment's free cards can book the estimate as, for its card's "Fits as …" line. */
  const fitGpuCounts = (env: ComputeEnvironment): number[] =>
    gpuDemand?.kind === 'vram'
      ? [...new Set(planGpuDemand({ environment: env, demand: gpuDemand }).map((c) => c.layout?.gpuCount ?? 0))]
          .filter((count) => count > 0)
          .sort((x, y) => x - y)
      : [];

  // Keep paging while the visible list is empty. loadMoreEnvs itself skips over pages that contribute
  // nothing bookable, so this fires once per stall rather than once per server page.
  useEffect(() => {
    if (
      !loading &&
      !filteredNodeEnvs.length &&
      paginationResponse &&
      paginationResponse.currentPage < paginationResponse.totalPages
    ) {
      loadMoreEnvs(isListedEnv);
    }
  }, [filteredNodeEnvs.length, loading, loadMoreEnvs, paginationResponse, isListedEnv]);

  const handleSelect = (
    node: NodeEnvironments,
    // The card's own copy of the environment — re-read from the node when it committed the pick, so
    // the availability stored here (and the GPU ids the launch resolves from it) is the fresh one,
    // not this list's cached entry.
    environment: ComputeEnvironment,
    gpuSelection: GpuSelection,
    gpuPlan: GpuPlan
  ) => {
    const envId = environment.id;
    // Block advancing when the duration is outside this env's paid window. The node doesn't reject
    // a too-short serviceStart — it just sets expiresAt = now + duration, so a job below the min
    // gets swept to Expired almost immediately. Catch it here instead.
    const { min, max } = durationBounds(environment);
    if (durationError) return;
    if (jobDurationSeconds < min || jobDurationSeconds > max) {
      // Build the range from whatever bounds are actually set — an unset max is Infinity, which
      // formatDuration would render as garbage ("Infinity seconds (Infinity:NaN:NaN)").
      const rangeText = Number.isFinite(max)
        ? `${formatDuration(min)} - ${formatDuration(max)}`
        : `min ${formatDuration(min)}`;
      toast.error(
        `The selected duration (${formatDuration(jobDurationSeconds)}) is outside the bounds for this environment (${rangeText}).`
      );
      captureError('inference_environment_select_failed', new Error('duration_outside_env_bounds'), {
        stage: 'duration_bounds',
        duration_seconds: jobDurationSeconds,
        min_seconds: min,
        max_seconds: Number.isFinite(max) ? max : null,
        environment_id: environment.id,
        node_id: node.id,
        branch,
      });
      // Session length can be adjusted in the search panel above the results.
      return;
    }
    setSelectedEnv({
      environment,
      gpuSelection,
      gpuPlan,
      // Preserve a package handoff floor across a re-select in this step (mirrors the URL round-trip),
      // so a user who re-picks the same/another env in the custom flow keeps the package's min floor.
      // The custom flow only ever carries a `floor` sizing here (never pinned).
      sizing: selectedEnv?.sizing,
      nodeInfo: {
        currentAddrs: node.currentAddrs,
        friendlyName: node.friendlyName,
        id: node.id,
        latestBenchmarkResults: node.latestBenchmarkResults,
        multiaddrs: node.multiaddrs,
      },
    });
    const estimate = estimateSelectionForAnalytics(environment, gpuSelection, jobDurationSeconds);
    posthog.capture('inference_environment_selected', {
      nodeId: node.id,
      environmentId: envId,
      gpuCount: estimate.gpuCount,
      gpuTypes: estimate.gpuTypes,
      cpu: estimate.cpu,
      ram: estimate.ram,
      disk: estimate.disk,
      price: estimate.price,
      durationSeconds: jobDurationSeconds,
      sizing: selectedEnv?.sizing,
      flowType,
      branch,
    });
    onEnvSelected({ peerId: node.id, envId, gpuSelection, gpuPlan }, estimate);
  };

  const onDurationChange = (seconds: number) => {
    setDurationDraft(seconds);
    setDurationTouched(true);
    // Keep the last valid quote while the user clears or replaces the field.
    if (!Number.isFinite(seconds) || seconds < 1) return;
    setJobDurationSeconds(seconds);
    if (selectedEnv) {
      const { min, max } = serviceDurationBounds(selectedEnv.environment);
      if (seconds < min || seconds > max) {
        setSelectedEnv(null);
      }
    }
  };

  const showDurationError = durationTouched && !!durationError;

  const onPresetSelect = (seconds: number) => {
    setDurationSource('preset');
    onDurationChange(seconds);
  };

  const onCustomDurationChange = (seconds: number) => {
    setDurationSource('custom');
    onDurationChange(seconds);
  };

  return (
    <>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        {declaredResources && <DeclaredResources recommended={declaredResources} />}

        <div className={styles.settings}>
          {isCustomModelFlow && (sizingLoading || customSizing) && (
            <CustomModelSizingPanel
              contextChoices={contextChoices}
              contextUnknown={contextUnknown}
              contextValue={sizingContext === null ? DEFAULT_CONTEXT_OPTION : String(sizingContext)}
              gaps={customSizing?.gaps}
              highlightContext={noEnvFitsEstimate}
              layouts={sizingLayouts}
              loading={sizingLoading}
              onContextChange={onSizingContextChange}
              ref={sizingPanelRef}
              widths={customSizing?.widths ?? null}
            />
          )}

          <Card direction="column" padding="sm" radius="md" shadow="black" spacing="sm" variant="glass">
            <SettingsSection
              description={
                durationError ? (
                  'Pick a length or enter your own. Prices below update to match.'
                ) : (
                  <>
                    Runs until <strong>{formatSessionEnd(jobDurationSeconds)}</strong>. Prices below cover the whole
                    session.
                  </>
                )
              }
              icon={<ScheduleIcon />}
              title="Session length"
            >
              <div className={styles.durationPresets} role="group" aria-label="Session length">
                <TabBar
                  activeKey={durationSource === 'preset' ? String(durationDraft) : ''}
                  ariaLabel="Session length presets"
                  cardVariant="glass"
                  size="sm"
                  tabs={DURATION_PRESETS.map(({ label, seconds }) => ({
                    key: String(seconds),
                    label,
                    onClick: () => onPresetSelect(seconds),
                  }))}
                />
                <span aria-hidden className={styles.durationOr}>
                  or
                </span>
                <DurationInput
                  ariaLabel="Custom session length"
                  availableUnits={DURATION_UNIT_OPTIONS}
                  className={styles.sessionDuration}
                  defaultUnit="hours"
                  emptyWhenZero
                  invalid={showDurationError}
                  min={1}
                  onChange={onCustomDurationChange}
                  placeholder="Custom"
                  size="sm"
                  unitControl="auto"
                  value={durationSource === 'preset' ? 0 : durationDraft}
                />
              </div>
            </SettingsSection>
          </Card>
        </div>

        <div className={styles.filters}>
          <Select
            ariaLabel="Filter envs by GPU model"
            className={styles.gpuSelect}
            multiple
            name="gpuName"
            onChange={onFilterChange}
            options={gpuOptions}
            placeholder="Filter envs by GPU model"
            renderOption={(option) => <HardwareLabel type="gpu" value={option.label} />}
            renderSelectedValue={(option) => <HardwareLabel type="gpu" value={option} />}
            size="sm"
            startAdornment={<FilterListIcon />}
            value={filterValues.gpuName}
          />
          <Select
            ariaLabel="Sorting"
            name="sortBy"
            onChange={onFilterChange}
            options={sortOptions}
            placeholder="No sorting"
            size="sm"
            startAdornment={<SwapVertIcon />}
            value={filterValues.sortBy}
          />
        </div>

        <div className={styles.list}>
          {isCustomModelFlow && sizingLoading ? null : filteredNodeEnvs.length > 0 ? (
            <>
              <div className={styles.listHint} role="status">
                {durationError ? (
                  <>
                    <strong>Choose a session length above</strong> to see total prices and continue.
                  </>
                ) : (
                  'Adjust the GPU count on an environment if needed, then start it.'
                )}
                {isCustomModelFlow && sizingRequirement && (
                  <div>Environments listed can hold this model at {sizedContextLabel} context.</div>
                )}
              </div>
              {filteredNodeEnvs.map((node) =>
                node.computeEnvironments.environments.map((env) => {
                  const isPriorSelection =
                    selectedEnv?.environment.id === env.id && selectedEnv?.nodeInfo.id === node.id;
                  const { min, max } = durationBounds(env);
                  const durationBlockedReason =
                    durationError ??
                    (jobDurationSeconds < min
                      ? `Choose at least ${formatDuration(min)} for this environment.`
                      : jobDurationSeconds > max
                        ? `Choose ${formatDuration(max)} or less for this environment.`
                        : undefined);
                  return (
                    <div key={`${node.id}-${env.id}`} className={styles.environmentOption}>
                      {!durationError && durationBlockedReason && (
                        <p className={styles.durationNotice}>{durationBlockedReason}</p>
                      )}
                      <InferenceEnvironmentCard
                        disabledReason={durationBlockedReason}
                        // Zero-GPU picks are Template-flow policy only: this picker is shared with CustomModel
                        // (see isEnvPickerFlow in resources-page.tsx), which must keep the existing hard floor
                        // of 1 — a custom HF model has no declared requirement to justify skipping GPU entirely.
                        allowZeroGpu={flowType === InferenceFlowType.Template}
                        declaredRequirements={declaredResources}
                        gpuDemand={gpuDemand}
                        forcedGpuCount={forcedGpuCount}
                        durationSeconds={jobDurationSeconds}
                        environment={env}
                        initialSelection={isPriorSelection ? selectedEnv?.gpuSelection : undefined}
                        sizing={selectedEnv?.sizing}
                        selected={isPriorSelection}
                        nodeInfo={node}
                        onSelect={(gpuSelection, pickedEnv, gpuPlan) =>
                          handleSelect(node, pickedEnv, gpuSelection, gpuPlan)
                        }
                        fitSummary={
                          isCustomModelFlow && sizingRequirement ? (
                            <FitSummary gpuCounts={fitGpuCounts(env)} />
                          ) : undefined
                        }
                      />
                    </div>
                  );
                })
              )}
            </>
          ) : noEnvFitsEstimate ? (
            <NoFitCard context={sizedContextLabel} onChooseShorter={() => sizingPanelRef.current?.focusContext()} />
          ) : (
            <p className="alignSelfCenter">{loading ? 'Loading environments…' : 'No environments found'}</p>
          )}
          {/* Outside the empty-check above: a page whose envs all get filtered out client-side must
              still offer a way forward, or the user is stranded with pages left unexplored. */}
          {paginationResponse && paginationResponse.currentPage < paginationResponse.totalPages && (
            <Button
              className="alignSelfCenter"
              color="accent2"
              loading={loading}
              onClick={() => loadMoreEnvs(isListedEnv)}
            >
              Load more
            </Button>
          )}
        </div>
      </Card>
    </>
  );
};

export default SelectInferenceEnvironment;
