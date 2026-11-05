import Button from '@/components/button/button';
import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import useCustomModelSizing from '@/components/hooks/use-custom-model-sizing';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import DeclaredResources from '@/components/inference/declared-resources';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import DurationInput from '@/components/input/duration-input';
import Select from '@/components/input/select';
import Switch from '@/components/switch/switch';
import { CHAIN_ID } from '@/constants/chains';
import { isInferenceNode } from '@/constants/nodes';
import { getSupportedTokens } from '@/constants/tokens';
import { useInferenceContext } from '@/context/inference-context';
import { DEFAULT_FILTERS, RawFilters, useRunJobEnvsContext } from '@/context/run-job-envs-context';
import { captureError } from '@/lib/analytics';
import { resolveInferenceBranch } from '@/lib/inference-analytics';
import { estimateModelsVramGb } from '@/services/vram-estimate';
import { ComputeEnvironment, ComputeResource, NodeEnvironments } from '@/types/environments';
import { InferenceFlowType } from '@/types/inference';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import {
  DeclaredRequirement,
  demandOf,
  formatGpuLayouts,
  GpuDemand,
  gpuGroupKey,
  GpuPlan,
  isBenchmarkEnv,
  isGpuResource,
  planGpuDemand,
} from '@/utils/env-resources';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import { formatDuration } from '@/utils/formatters';
import { getAvailableAmount } from '@/utils/resources';
import { serviceDurationBounds } from '@/utils/service-duration';
import { useFormik } from 'formik';
import posthog from 'posthog-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './select-inference-environment.module.css';

/** Paid service-on-demand duration bounds for an env. Inference always uses a paid token, so the
 *  top-level bounds apply (not the `free.*` ones). */
function durationBounds(env: ComputeEnvironment): { min: number; max: number } {
  return serviceDurationBounds(env);
}

/** An env is bookable for inference when its node is on the inference allowlist and it (a) advertises
 *  service-on-demand support — the node rejects serviceStart with 403 otherwise — (b) isn't the node's
 *  own benchmark environment, and (c) accepts a paid token we support (USDC / COMPY). */
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
  return getEnvSupportedTokens(env, true).length > 0;
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
  tokenAddress: string,
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

  const prices = environment.fees?.[CHAIN_ID]?.find((fee) => fee.feeToken === tokenAddress)?.prices;
  const priceFor = (id: string) => prices?.find((p) => p.id === id)?.price ?? 0;

  let gpuCount = 0;
  let gpuPrice = 0;
  const gpuTypes: string[] = [];
  gpuByDescription.forEach((entries, key) => {
    const requested = gpuSelection[key];
    const available = entries.reduce((sum, entry) => sum + getAvailableAmount(entry), 0);
    const units = requested === undefined ? available : Math.min(Math.max(requested, 0), available);
    if (units > 0) {
      gpuCount += units;
      gpuTypes.push(key);
    }
    // Price the same clamped quantity that `gpuCount` reports, spread over the group's entries in
    // order — several entries can share a description, and each has its own price id.
    let left = units;
    entries.forEach((entry) => {
      const take = Math.min(left, getAvailableAmount(entry));
      gpuPrice += priceFor(entry.id) * take;
      left -= take;
    });
  });

  const cpuAmount = getAvailableAmount(cpu);
  const ramAmount = getAvailableAmount(ram);
  const diskAmount = getAvailableAmount(disk);
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

type FilterFormValues = {
  gpuName: string[];
  feeToken: string;
  sortBy: string;
};

type SelectInferenceEnvironmentProps = {
  /** Fired after an environment/token/gpu pick is committed to context. Receives the freshly-picked
   *  values so the caller can navigate with them without waiting for context state to settle. */
  onEnvSelected: (
    picked: { peerId: string; envId: string; tokenAddress: string; gpuSelection: GpuSelection; gpuPlan: GpuPlan },
    /** Resources/GPU of the pick itself — context hasn't settled yet, so the caller cannot derive these. */
    estimate: InferenceSelectionEstimate
  ) => void;
  /** Which flow is using the picker — tags the analytics events with the right branch. */
  flowType: InferenceFlowType;
  /**
   * The recommended resources of the template or package being launched, shown above the list. Left
   * out of a custom-model flow started from the model picker, which has none.
   */
  declaredResources?: DeclaredRequirement[];
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
    setSelectedToken,
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
   * settings, a SOFT filter: environments and layouts that don't fit are hidden until the user asks to
   * see every GPU (unverified). Unused once a template or package declares a recommendation.
   */
  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel && !declaredResources;
  const customModel = isCustomModelFlow ? selectedModels[0] : undefined;
  const { loading: sizingLoading, sizing: customSizing } = useCustomModelSizing({
    enabled: isCustomModelFlow,
    model: customModel,
    engine,
    params: customModel ? modelParamsByModel[customModel.id] : undefined,
    hfToken,
  });
  const sessionSettingsRef = useRef<HTMLDivElement>(null);
  const [durationDraft, setDurationDraft] = useState(jobDurationSeconds);
  const durationError =
    !Number.isFinite(durationDraft) || durationDraft < 1 ? 'Enter a session length greater than zero.' : undefined;
  const [showAllGpus, setShowAllGpus] = useState(false);
  const gpuDemand = useMemo<GpuDemand | undefined>(() => {
    if (!isCustomModelFlow || !customSizing) {
      return undefined;
    }
    return customSizing.requirement && !showAllGpus
      ? { kind: 'vram', requirement: customSizing.requirement }
      : { kind: 'units', widths: customSizing.widths };
  }, [isCustomModelFlow, customSizing, showAllGpus]);
  // Coarse fallback for the advisory warning when there is no layout estimate: total VRAM from the
  // parameter count. Never a filter.
  const modelVramGb = useMemo(
    () => (isCustomModelFlow && !customSizing?.requirement ? estimateModelsVramGb(selectedModels) : null),
    [isCustomModelFlow, customSizing, selectedModels]
  );
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

  const feeTokenOptions = useMemo(() => {
    const tokens = getSupportedTokens();
    return [
      { label: 'Any', value: '' },
      ...Object.keys(tokens).map((token) => ({ value: tokens[token as keyof typeof tokens].address, label: token })),
    ];
  }, []);

  const formik = useFormik<FilterFormValues>({
    initialValues: {
      feeToken: Array.isArray(filters.feeToken) ? '' : (filters.feeToken ?? ''),
      gpuName: filters.gpuName ?? [],
      sortBy: sort ?? '',
    },
    onSubmit: (values) => {
      const next: RawFilters = { ...DEFAULT_FILTERS };
      if (values.feeToken) {
        next.feeToken = values.feeToken;
      }
      if (values.gpuName.length > 0) {
        next.gpuName = values.gpuName;
      }
      setFilters(next);
      setSort(values.sortBy);
    },
  });

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
    tokenAddress: string,
    tokenSymbol: string,
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
    setSelectedToken({ address: tokenAddress, symbol: tokenSymbol });
    const estimate = estimateSelectionForAnalytics(environment, tokenAddress, gpuSelection, jobDurationSeconds);
    posthog.capture('inference_environment_selected', {
      nodeId: node.id,
      environmentId: envId,
      tokenSymbol,
      tokenAddress,
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
    onEnvSelected({ peerId: node.id, envId, tokenAddress, gpuSelection, gpuPlan }, estimate);
  };

  const onDurationChange = (seconds: number) => {
    setDurationDraft(seconds);
    // Keep the last valid quote while the user clears or replaces the field.
    if (!Number.isFinite(seconds) || seconds < 1) return;
    setJobDurationSeconds(seconds);
    if (selectedEnv) {
      const { min, max } = serviceDurationBounds(selectedEnv.environment);
      if (seconds < min || seconds > max) {
        setSelectedEnv(null);
        setSelectedToken(null);
      }
    }
  };

  return (
    <>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <h3>Environments</h3>

        {declaredResources && <DeclaredResources recommended={declaredResources} />}

        {isCustomModelFlow && customSizing && (
          <div className="flexColumn gapSm" role="note">
            {customSizing.widths && (
              <div className="textSecondary">
                This model&apos;s attention heads split across {customSizing.widths.join(', ')} GPU
                {customSizing.widths.length === 1 && customSizing.widths[0] === 1 ? '' : 's'}, so only those counts are
                offered.
              </div>
            )}
            {customSizing.notes.map((note) => (
              <div className="textSecondary" key={note}>
                {note}
              </div>
            ))}
            {customSizing.requirement && (
              <Switch
                checked={showAllGpus}
                label={
                  showAllGpus
                    ? "Show all GPUs (unverified): GPUs below this model's estimated VRAM are offered too."
                    : `Show all GPUs (unverified). Only GPUs that hold the estimated ${formatGpuLayouts(customSizing.requirement)} are shown now.`
                }
                name="showAllGpus"
                onChange={(_, checked) => setShowAllGpus(checked)}
              />
            )}
          </div>
        )}

        {/* No <form> wrapper: the Selects drive Formik via onChange and the button submits explicitly,
            so nothing here needs an implicit submit — and keeping it formless means Enter never re-runs
            the search by accident. */}
        <Card direction="column" padding="sm" radius="md" shadow="black" spacing="sm" variant="glass">
          <div className={styles.filters}>
            <Select
              className={styles.gpuSelect}
              label="GPUs"
              multiple
              name="gpuName"
              onChange={formik.handleChange}
              options={gpuOptions}
              placeholder="Any GPU"
              renderOption={(option) => <HardwareLabel type="gpu" value={option.label} />}
              renderSelectedValue={(option) => <HardwareLabel type="gpu" value={option} />}
              size="sm"
              value={formik.values.gpuName}
            />
            <Select
              label="Sorting"
              name="sortBy"
              onChange={formik.handleChange}
              options={sortOptions}
              placeholder="No sorting"
              size="sm"
              value={formik.values.sortBy}
            />
            <Select
              label="Fee token"
              name="feeToken"
              onChange={formik.handleChange}
              options={feeTokenOptions}
              placeholder="Any"
              size="sm"
              value={formik.values.feeToken}
            />
          </div>
          <div className={styles.actionsRow}>
            <Button
              className="alignSelfStart"
              color="accent2"
              loading={loading}
              onClick={() => formik.handleSubmit()}
              type="button"
              variant="filled"
            >
              Find environments
            </Button>
          </div>
          <div className={styles.sessionSettings} ref={sessionSettingsRef}>
            <div className={styles.sessionCopy}>
              <strong>Session length</strong>
              <span>Choose how long to run. Total prices update automatically.</span>
            </div>
            <div className={styles.durationControls}>
              <div>
                <span className={styles.presetLabel}>Quick choices</span>
                <div className={styles.durationPresets} role="group" aria-label="Session length presets">
                  {[
                    { label: '30 min', seconds: 1800 },
                    { label: '1 hour', seconds: 3600 },
                    { label: '2 hours', seconds: 7200 },
                    { label: '4 hours', seconds: 14400 },
                    { label: '8 hours', seconds: 28800 },
                  ].map(({ label, seconds }) => (
                    <button
                      key={seconds}
                      type="button"
                      className={styles.durationPreset}
                      aria-pressed={durationDraft === seconds}
                      onClick={() => onDurationChange(seconds)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <DurationInput
                availableUnits={DURATION_UNIT_OPTIONS}
                className={styles.sessionDuration}
                defaultUnit="hours"
                label="Custom duration"
                errorText={durationError}
                min={1}
                onChange={onDurationChange}
                size="md"
                radius={24}
                unitControl="segmented"
                value={durationDraft}
              />
            </div>
          </div>
        </Card>

        <div className={styles.resultsHeader}>
          <strong>Available environments</strong>
          <div className={styles.resultsDuration}>
            <span role="status">
              {durationError ? (
                'Enter a valid session length to continue'
              ) : (
                <>
                  Total prices for <strong>{formatDuration(jobDurationSeconds)}</strong>
                </>
              )}
            </span>
            <Button
              color="accent1"
              onClick={() => {
                sessionSettingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                sessionSettingsRef.current?.querySelector('input')?.focus({ preventScroll: true });
              }}
              size="sm"
              type="button"
              variant="transparent"
            >
              Edit duration
            </Button>
          </div>
        </div>
        <div className={styles.list}>
          {isCustomModelFlow && sizingLoading ? (
            <p className="alignSelfCenter">Checking the model&apos;s GPU needs…</p>
          ) : filteredNodeEnvs.length > 0 ? (
            filteredNodeEnvs.map((node) =>
              node.computeEnvironments.environments.map((env) => {
                const isPriorSelection = selectedEnv?.environment.id === env.id && selectedEnv?.nodeInfo.id === node.id;
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
                      modelVramGb={modelVramGb ?? undefined}
                      advisoryRequirement={isCustomModelFlow ? (customSizing?.requirement ?? undefined) : undefined}
                      defaultToken={Array.isArray(filters.feeToken) ? undefined : filters.feeToken}
                      durationSeconds={jobDurationSeconds}
                      environment={env}
                      initialSelection={isPriorSelection ? selectedEnv?.gpuSelection : undefined}
                      sizing={selectedEnv?.sizing}
                      selected={isPriorSelection}
                      nodeInfo={node}
                      onSelect={(tokenAddress, tokenSymbol, gpuSelection, pickedEnv, gpuPlan) =>
                        handleSelect(node, pickedEnv, tokenAddress, tokenSymbol, gpuSelection, gpuPlan)
                      }
                    />
                  </div>
                );
              })
            )
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
