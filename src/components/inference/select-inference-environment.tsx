import Button from '@/components/button/button';
import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import DurationInput from '@/components/input/duration-input';
import Select from '@/components/input/select';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { useInferenceContext } from '@/context/inference-context';
import { DEFAULT_FILTERS, RawFilters, useRunJobEnvsContext } from '@/context/run-job-envs-context';
import { INFERENCE_ENGINE_OPTIONS } from '@/services/huggingface-service';
import { ComputeEnvironment, NodeEnvironments } from '@/types/environments';
import { InferenceEngine } from '@/types/huggingface';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration } from '@/utils/formatters';
import { useFormik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './select-inference-environment.module.css';

/** Paid service-on-demand duration bounds for an env (0 / Infinity when unset). Inference always
 *  uses a paid token, so the top-level bounds apply (not the `free.*` ones). */
function durationBounds(env: ComputeEnvironment): { min: number; max: number } {
  return {
    min: env.minJobDuration ?? 0,
    max: env.maxJobDuration ?? Infinity,
  };
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
  onEnvSelected: (picked: { peerId: string; envId: string; tokenAddress: string; gpuSelection: GpuSelection }) => void;
};

const SelectInferenceEnvironment: React.FC<SelectInferenceEnvironmentProps> = ({ onEnvSelected }) => {
  const { loading, loadMoreEnvs, nodeEnvs, paginationResponse, filters, setFilters, setSort, sort } =
    useRunJobEnvsContext();
  const {
    jobDurationSeconds,
    setJobDurationSeconds,
    setSelectedEnv,
    selectedEnv,
    setSelectedToken,
    engine,
    setEngine,
  } = useInferenceContext();

  // Set when a pick is rejected because the chosen duration falls outside the env's paid
  // min/max job-duration window. Cleared on the next valid pick or duration change.
  const [durationError, setDurationError] = useState<string | null>(null);

  // Duration changed: clear the stale error, and if the already-picked env no longer fits the new
  // duration, drop the selection so the "Skip" nav can't carry an out-of-window pick forward.
  const onDurationChange = (seconds: number) => {
    setDurationError(null);
    setJobDurationSeconds(seconds);
    if (selectedEnv) {
      const { min, max } = durationBounds(selectedEnv.environment);
      if (seconds < min || seconds > max) {
        setSelectedEnv(null);
        setSelectedToken(null);
      }
    }
  };

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

  // Keep only environments that:
  // (a) advertise service-on-demand support — the node rejects serviceStart with 403 otherwise
  // (b) support a paid token we accept (USDC / COMPY).
  const filteredNodeEnvs = useMemo(() => {
    const result: NodeEnvironments[] = [];
    nodeEnvs.forEach((nodeEnv) => {
      const filteredEnvs = nodeEnv.computeEnvironments.environments.filter((env) => {
        if (!env.features?.services) {
          return false;
        }
        if (!env.fees?.[CHAIN_ID]) {
          return false;
        }
        return env.fees[CHAIN_ID].some(
          (fee) =>
            fee.feeToken.toLowerCase() === getSupportedTokens().COMPY.address.toLowerCase() ||
            fee.feeToken.toLowerCase() === getSupportedTokens().USDC.address.toLowerCase()
        );
      });
      if (filteredEnvs.length > 0) {
        result.push({
          ...nodeEnv,
          computeEnvironments: { ...nodeEnv.computeEnvironments, environments: filteredEnvs },
        });
      }
    });
    return result;
  }, [nodeEnvs]);

  // If everything was filtered out and there are more pages, load the next one.
  useEffect(() => {
    if (
      !loading &&
      !filteredNodeEnvs.length &&
      paginationResponse &&
      paginationResponse.currentPage < paginationResponse.totalPages
    ) {
      loadMoreEnvs();
    }
  }, [filteredNodeEnvs.length, loading, loadMoreEnvs, paginationResponse]);

  const handleSelect = (
    node: NodeEnvironments,
    envId: string,
    tokenAddress: string,
    tokenSymbol: string,
    gpuSelection: GpuSelection
  ) => {
    const environment = node.computeEnvironments.environments.find((env) => env.id === envId);
    if (!environment) {
      return;
    }
    // Block advancing when the duration is outside this env's paid window. The node doesn't reject
    // a too-short serviceStart — it just sets expiresAt = now + duration, so a job below the min
    // gets swept to Expired almost immediately. Catch it here instead.
    const { min, max } = durationBounds(environment);
    if (jobDurationSeconds < min || jobDurationSeconds > max) {
      // Build the range from whatever bounds are actually set — an unset max is Infinity, which
      // formatDuration would render as garbage ("Infinity seconds (Infinity:NaN:NaN)").
      const rangeText = Number.isFinite(max)
        ? `${formatDuration(min)} - ${formatDuration(max)}`
        : `min ${formatDuration(min)}`;
      toast.error(
        `The selected duration (${formatDuration(jobDurationSeconds)}) is outside the bounds for this environment (${rangeText}).`
      );
      if (jobDurationSeconds < min) {
        setDurationError(`This environment needs at least ${formatDuration(min)}. Increase the duration above.`);
        return;
      }
      if (jobDurationSeconds > max) {
        setDurationError(`This environment allows at most ${formatDuration(max)}. Decrease the duration above.`);
        return;
      }
    }
    setDurationError(null);
    setSelectedEnv({
      environment,
      gpuSelection,
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
    onEnvSelected({ peerId: node.id, envId, tokenAddress, gpuSelection });
  };

  return (
    <>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
        <div className={styles.durationRow}>
          <div>
            <h3>Engine &amp; duration</h3>
            <div className="textSecondary">
              Prices below are shown for <strong>selected duration</strong>
            </div>
          </div>
          <div className={styles.controls}>
            <Select<InferenceEngine>
              className={styles.input}
              label="Engine"
              onChange={(e) => setEngine(e.target.value as InferenceEngine)}
              options={INFERENCE_ENGINE_OPTIONS}
              size="sm"
              value={engine}
            />
            <DurationInput
              availableUnits={DURATION_UNIT_OPTIONS}
              className={styles.input}
              defaultUnit="hours"
              errorText={durationError ?? undefined}
              label="Session length"
              min={1}
              onChange={onDurationChange}
              size="sm"
              value={jobDurationSeconds}
            />
          </div>
        </div>
      </Card>

      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <h3>Environments</h3>

        <form onSubmit={formik.handleSubmit}>
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
            <div className="actionsGroupMdEnd">
              <Button className="alignSelfStart" color="accent2" loading={loading} type="submit" variant="filled">
                Find environments
              </Button>
            </div>
          </Card>
        </form>

        <div className={styles.list}>
          {filteredNodeEnvs.length > 0 ? (
            <>
              {filteredNodeEnvs.map((node) =>
                node.computeEnvironments.environments.map((env) => {
                  const isPriorSelection =
                    selectedEnv?.environment.id === env.id && selectedEnv?.nodeInfo.id === node.id;
                  return (
                    <InferenceEnvironmentCard
                      defaultToken={Array.isArray(filters.feeToken) ? undefined : filters.feeToken}
                      durationSeconds={jobDurationSeconds}
                      environment={env}
                      initialSelection={isPriorSelection ? selectedEnv?.gpuSelection : undefined}
                      key={`${node.id}-${env.id}`}
                      sizing={selectedEnv?.sizing}
                      selected={isPriorSelection}
                      nodeInfo={node}
                      onSelect={(tokenAddress, tokenSymbol, gpuSelection) =>
                        handleSelect(node, env.id, tokenAddress, tokenSymbol, gpuSelection)
                      }
                    />
                  );
                })
              )}
              {paginationResponse && paginationResponse.currentPage < paginationResponse.totalPages && (
                <Button className="alignSelfCenter" color="accent2" loading={loading} onClick={loadMoreEnvs}>
                  Load more
                </Button>
              )}
            </>
          ) : (
            <p className="alignSelfCenter">{loading ? 'Loading environments…' : 'No environments found'}</p>
          )}
        </div>
      </Card>
    </>
  );
};

export default SelectInferenceEnvironment;
