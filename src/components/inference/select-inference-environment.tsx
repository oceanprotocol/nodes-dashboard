import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import DurationInput from '@/components/input/duration-input';
import Select from '@/components/input/select';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { useInferenceContext } from '@/context/inference-context';
import { DEFAULT_FILTERS, RawFilters, useRunJobEnvsContext } from '@/context/run-job-envs-context';
import { NodeEnvironments } from '@/types/environments';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { useFormik } from 'formik';
import { useEffect, useMemo } from 'react';
import styles from './select-inference-environment.module.css';

const sortOptions = [
  { label: 'Most powerful', value: JSON.stringify({ benchmarkTotalScore: 'desc' }) },
  { label: 'Cheapest', value: JSON.stringify({ price: 'asc' }) },
  { label: 'Most expensive', value: JSON.stringify({ price: 'desc' }) },
];

type FilterFormValues = {
  gpuName: string[];
  feeToken: string;
  sortBy: string;
};

type SelectInferenceEnvironmentProps = {
  onEnvSelected: () => void;
};

const SelectInferenceEnvironment: React.FC<SelectInferenceEnvironmentProps> = ({ onEnvSelected }) => {
  const { loading, loadMoreEnvs, nodeEnvs, paginationResponse, filters, setFilters, setSort, sort } =
    useRunJobEnvsContext();
  const { jobDurationSeconds, setJobDurationSeconds, setSelectedEnv, selectedEnv, setSelectedToken } =
    useInferenceContext();

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

  // Keep only environments that support a paid token we accept (USDC / COMPY).
  const filteredNodeEnvs = useMemo(() => {
    const result: NodeEnvironments[] = [];
    nodeEnvs.forEach((nodeEnv) => {
      const filteredEnvs = nodeEnv.computeEnvironments.environments.filter((env) => {
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
    setSelectedEnv({
      environment,
      gpuSelection,
      nodeInfo: {
        currentAddrs: node.currentAddrs,
        friendlyName: node.friendlyName,
        id: node.id,
        latestBenchmarkResults: node.latestBenchmarkResults,
        multiaddrs: node.multiaddrs,
      },
    });
    setSelectedToken({ address: tokenAddress, symbol: tokenSymbol });
    onEnvSelected();
  };

  return (
    <>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
        <div className={styles.durationRow}>
          <div>
            <h3>Duration</h3>
            <div className="textSecondary">
              Prices below are shown for <strong>selected duration</strong>
            </div>
          </div>
          <DurationInput
            availableUnits={DURATION_UNIT_OPTIONS}
            defaultUnit="hours"
            min={0}
            onChange={setJobDurationSeconds}
            size="md"
            value={jobDurationSeconds}
          />
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
                renderOption={(option) => <GpuLabel gpu={option.label} />}
                renderSelectedValue={(option) => <GpuLabel gpu={option} />}
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
                      selected={isPriorSelection}
                      nodeInfo={{
                        currentAddrs: node.currentAddrs,
                        friendlyName: node.friendlyName,
                        id: node.id,
                        latestBenchmarkResults: node.latestBenchmarkResults,
                        multiaddrs: node.multiaddrs,
                      }}
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
