import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import DurationInput from '@/components/input/duration-input';
import Slider from '@/components/slider/slider';
import config from '@/config';
import { SelectedToken, useRunJobContext } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration, formatTokenAmount, roundTokenAmount } from '@/utils/formatters';
import { capacityOf, distributeGpus } from '@/utils/resources';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress, Collapse, Tooltip } from '@mui/material';
import { usePrivy } from '@privy-io/react-auth';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import * as Yup from 'yup';
import styles from './select-resources.module.css';

type SelectResourcesProps = {
  environment: ComputeEnvironment;
  freeCompute: boolean;
  token: SelectedToken | null;
};

type ResourcesFormValues = {
  gpuCount: number;
  maxJobDurationSeconds: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const SelectResources = ({ environment, freeCompute, token }: SelectResourcesProps) => {
  const { login } = usePrivy();
  const router = useRouter();

  const { getEnvs, isReady: p2pReady } = useP2P();

  const { account } = useOceanAccount();

  const {
    estimatedTotalCost,
    fetchEstimatedCost,
    multiaddrsOrPeerId,
    selectedResources,
    setEstimatedTotalCost,
    setSelectedResources,
  } = useRunJobContext();

  const [initComputeError, setInitComputeError] = useState<unknown | null>(null);
  const [isLoadingCost, setIsLoadingCost] = useState(false);

  const [liveEnv, setLiveEnv] = useState<ComputeEnvironment | null>(null);
  const env = liveEnv ?? environment;

  useEffect(() => {
    let cancelled = false;
    setLiveEnv(null);
    if (!p2pReady || !multiaddrsOrPeerId) {
      return;
    }
    (async () => {
      try {
        const envs: ComputeEnvironment[] = await getEnvs(multiaddrsOrPeerId);
        const fresh = envs?.find((e) => e.id === environment.id);
        if (!cancelled && fresh) {
          setLiveEnv(fresh);
        }
      } catch (error) {
        console.warn('Failed to refetch live environment availability, using cached data:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [environment.id, getEnvs, multiaddrsOrPeerId, p2pReady]);

  const costEstimateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ESTIMATE_COST_DEBOUNCE_MS = 800;

  const isCostEstimated = !isLoadingCost && (estimatedTotalCost || estimatedTotalCost === 0) && !initComputeError;

  const {
    cpu,
    cpuAvailable,
    cpuFee,
    disk,
    diskAvailable,
    diskFee,
    gpus,
    gpusAvailable,
    gpuFees,
    maxJobDurationSeconds,
    minJobDurationSeconds,
    ram,
    ramAvailable,
    ramFee,
  } = useEnvResources({
    environment: env,
    freeCompute,
    tokenAddress: token?.address ?? '',
  });

  // The environment is split into equal GPU-sized parts: picking N GPUs grants N proportional
  // shares of CPU/RAM/disk. Nodes with multiple physical GPUs of the same model expose one
  // resource entry per GPU (each total: 1), so we sum capacity across all GPU entries.
  const hasGpu = gpus.length > 0;

  // Total physical GPU slots across all GPU resource entries the node advertises.
  // No-GPU environments behave as a single, whole-environment unit.
  const totalUnits = hasGpu ? Math.max(1, gpus.reduce((sum, g) => sum + capacityOf(g), 0)) : 1;
  const availableGpuUnits = hasGpu
    ? gpus.reduce((sum, g) => sum + (gpusAvailable[g.id] ?? 0), 0)
    : 1;
  const maxSelectableUnits = Math.min(totalUnits, Math.max(0, availableGpuUnits));
  const gpuExhausted = hasGpu && maxSelectableUnits < 1;

  // Per-unit (per-GPU) share of each resource, derived from full env capacity / total units.
  const perUnitCpu = capacityOf(cpu) / totalUnits;
  const perUnitRam = capacityOf(ram) / totalUnits;
  const perUnitDisk = capacityOf(disk) / totalUnits;

  const minAllowedJobDurationSeconds = minJobDurationSeconds ?? 0;
  const maxAllowedJobDurationSeconds = maxJobDurationSeconds ?? 0;

  const selectedGpuCount = selectedResources?.gpuCount;
  const selectedMaxJobDurationSeconds = selectedResources?.maxJobDurationSeconds;

  const initialGpuCount = hasGpu ? clamp(selectedGpuCount || 1, 1, Math.max(1, maxSelectableUnits)) : 1;

  const formik = useFormik<ResourcesFormValues>({
    enableReinitialize: true,
    initialValues: {
      gpuCount: initialGpuCount,
      maxJobDurationSeconds: selectedMaxJobDurationSeconds ?? minAllowedJobDurationSeconds,
    },
    onSubmit: (values) => {
      if (!account?.isConnected) {
        login();
        return;
      }
      if (!freeCompute && !estimatedTotalCost) {
        return;
      }
      setEstimatedTotalCost(
        estimatedTotalCost && token?.address ? roundTokenAmount(estimatedTotalCost, token.address, 'up') : 0
      );
      setSelectedResources({
        cpuCores: derivedCpu,
        cpuId: cpu?.id ?? 'cpu',
        diskSpace: derivedDisk,
        diskId: disk?.id ?? 'disk',
        gpus: selectedGpuEntries,
        gpuCount: hasGpu ? values.gpuCount : 0,
        maxJobDurationSeconds: values.maxJobDurationSeconds,
        ram: derivedRam,
        ramId: ram?.id ?? 'ram',
      });
      posthog.capture('environment_configured', {
        cpuCores: derivedCpu,
        ram: derivedRam,
        diskSpace: derivedDisk,
        gpuCount: hasGpu ? values.gpuCount : 0,
        maxJobDurationSeconds: values.maxJobDurationSeconds,
        estimatedTotalCost,
        freeCompute,
      });
      const query = {
        ...router.query,
        cpu: derivedCpu,
        ram: derivedRam,
        disk: derivedDisk,
        // Encode the per-entry amount alongside the id (`id:amount`) so the exact GPU split the
        // user picked round-trips losslessly through the URL instead of being re-guessed.
        ...(hasGpu && {
          gpus: selectedGpuEntries.map((g) => `${g.id}:${g.amount}`),
          gpuCount: values.gpuCount,
        }),
        maxJobDuration: values.maxJobDurationSeconds,
      };

      if (estimatedTotalCost! > 0 && !freeCompute) {
        router.push({ pathname: '/run-job/payment', query });
      } else {
        router.push({ pathname: '/run-job/summary', query });
      }
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      gpuCount: Yup.number()
        .required('Required')
        .min(1, 'Select at least one unit')
        .max(Math.max(1, maxSelectableUnits), gpuExhausted ? 'Not enough available' : 'Limits exceeded')
        .integer('Invalid format'),
      maxJobDurationSeconds: Yup.number()
        .required('Required')
        .min(minAllowedJobDurationSeconds, 'Limits exceeded')
        .max(maxAllowedJobDurationSeconds, 'Limits exceeded'),
    }),
  });

  const unitCount = hasGpu ? formik.values.gpuCount : 1;

  // GPU resource entries allocated to the current unit-count selection, distributed across
  // the available physical GPUs in declared order.
  const selectedGpuEntries = useMemo(
    () => (hasGpu ? distributeGpus(unitCount, gpus, gpusAvailable) : []),
    [hasGpu, unitCount, gpus, gpusAvailable]
  );

  // A live availability refetch can drop maxSelectableUnits below the current selection (other
  // jobs grabbed GPUs). Clamp the slider down so the user can never request more than is free.
  useEffect(() => {
    if (hasGpu && formik.values.gpuCount > maxSelectableUnits) {
      formik.setFieldValue('gpuCount', Math.max(1, maxSelectableUnits));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGpu, maxSelectableUnits]);

  // Derived resource amounts for the chosen number of units, clamped to what's actually available.
  const derivedCpu = clamp(Math.round(perUnitCpu * unitCount), cpu?.min ?? 0, Math.max(0, cpuAvailable));
  const derivedRam = clamp(Math.round(perUnitRam * unitCount), ram?.min ?? 0, Math.max(0, ramAvailable));
  const derivedDisk = clamp(Math.round(perUnitDisk * unitCount), disk?.min ?? 0, Math.max(0, diskAvailable));

  const resourcesExhausted =
    gpuExhausted ||
    (!!cpu && cpuAvailable < (cpu.min ?? 0)) ||
    (!!ram && ramAvailable < (ram.min ?? 0)) ||
    (!!disk && diskAvailable < (disk.min ?? 0));

  const resources = useMemo(() => {
    const list = [
      { id: cpu?.id ?? 'cpu', amount: derivedCpu },
      { id: disk?.id ?? 'disk', amount: derivedDisk },
      { id: ram?.id ?? 'ram', amount: derivedRam },
    ];
    for (const gpu of selectedGpuEntries) {
      list.push({ id: gpu.id, amount: gpu.amount });
    }
    return list;
  }, [cpu?.id, disk?.id, ram?.id, selectedGpuEntries, derivedCpu, derivedRam, derivedDisk]);

  const estimateCost = useCallback(async () => {
    setIsLoadingCost(true);
    setInitComputeError(null);
    const maxJobDurationSec = formik.values.maxJobDurationSeconds;
    await fetchEstimatedCost({
      environment: env,
      freeCompute,
      maxJobDurationSeconds: maxJobDurationSec < 1 ? 1 : Math.ceil(maxJobDurationSec),
      multiaddrsOrPeerId: multiaddrsOrPeerId!,
      onError: (error) => setInitComputeError(error),
      resources,
      tokenAddress: token?.address,
    });
    setIsLoadingCost(false);
  }, [fetchEstimatedCost, env, freeCompute, formik.values.maxJobDurationSeconds, multiaddrsOrPeerId, resources, token]);

  useEffect(() => {
    if (costEstimateTimeoutRef.current) {
      clearTimeout(costEstimateTimeoutRef.current);
    }
    costEstimateTimeoutRef.current = setTimeout(() => {
      costEstimateTimeoutRef.current = null;
      estimateCost();
    }, ESTIMATE_COST_DEBOUNCE_MS);
    return () => {
      if (costEstimateTimeoutRef.current) {
        clearTimeout(costEstimateTimeoutRef.current);
      }
    };
  }, [estimateCost]);

  const setMaxGpus = () => {
    formik.setFieldValue('gpuCount', Math.max(1, maxSelectableUnits));
  };

  const setMaxJobDuration = () => {
    formik.setFieldValue('maxJobDurationSeconds', maxAllowedJobDurationSeconds);
  };

  const renderDerivedResource = (label: React.ReactNode, value: string, fee: React.ReactNode) => (
    <Card
      className={styles.derivedCard}
      direction="column"
      innerShadow="black"
      paddingX="md"
      paddingY="sm"
      radius="md"
      spacing="sm"
      variant="glass"
    >
      <div className={styles.derivedLabel}>{label}</div>
      <div className={styles.derivedValue}>{value}</div>
      <div className={styles.derivedHint}>{fee}</div>
    </Card>
  );

  const renderCostCard = () => {
    const renderCostEstimation = () => {
      if (isLoadingCost) {
        return (
          <h3 className={styles.estimationMessage}>
            <CircularProgress size={24} />
            Estimating cost...
          </h3>
        );
      }
      if (!p2pReady || (!estimatedTotalCost && estimatedTotalCost !== 0)) {
        return (
          <h3 className={styles.estimationMessage}>
            <CircularProgress size={24} />
            Connecting to node...
          </h3>
        );
      }
      return (
        <div>
          <span className={styles.token}>{token?.symbol}</span>
          &nbsp;
          <span className={styles.amount}>{token ? formatTokenAmount(estimatedTotalCost, token.address) : null}</span>
        </div>
      );
    };

    return (
      <Card
        className={styles.costCard}
        direction="column"
        innerShadow="black"
        paddingX="md"
        paddingY="sm"
        radius="md"
        spacing="sm"
        variant="glass"
      >
        <div className={styles.costEstimation}>
          <h3>Estimated total cost</h3>
          {renderCostEstimation()}
        </div>
        <div className="alignSelfEnd textSuccessDarker">
          If your job finishes earlier than estimated, the unconsumed tokens remain in your escrow
        </div>
      </Card>
    );
  };

  const renderConnectionErrorCard = () => {
    if (!initComputeError) {
      return null;
    }
    let errorText;
    if (initComputeError instanceof Error) {
      errorText = initComputeError.message;
    }
    return (
      <Card direction="column" paddingX="md" paddingY="sm" radius="md" spacing="sm" variant="error">
        <h3>Could not reach this node</h3>
        {errorText ? <p>{errorText}</p> : null}
        <p>
          This may be due to missing WSS, TLS, or P2P circuit relay configuration on the node.
          <br />
          If you are the node operator, please check your node&apos;s network setup.
        </p>
        <Button
          className="alignSelfStart"
          color="accent2"
          href={config.links.docs}
          size="sm"
          target="_blank"
          variant="filled"
        >
          Visit docs
        </Button>
      </Card>
    );
  };

  // Show a single rate when every GPU costs the same, otherwise a range, so heterogeneous
  // environments don't advertise just the first GPU's price.
  const gpuFeeHint = (() => {
    if (!hasGpu) return '';
    if (freeCompute) return 'Free';
    const fees = gpus.map((g) => gpuFees[g.id] ?? 0);
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    const range = min === max ? `${min}` : `${min}–${max}`;
    return `${range} ${token?.symbol}/unit`;
  })();

  const gpuDisplayLabel = hasGpu
    ? gpus.every((g) => g.description === gpus[0].description)
      ? gpus[0].description
      : gpus.map((g) => g.description ?? g.id).join(' / ')
    : '';

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Select resources</h3>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        {hasGpu ? (
          <>
            <div className={styles.gpuHeader}>
              <GpuLabel gpu={gpuDisplayLabel} />
              <div className={styles.gpuHeaderEnd}>
                <span className={styles.gpuHint}>{gpuFeeHint}</span>
                <Button
                  color="accent2"
                  disabled={gpuExhausted}
                  onClick={setMaxGpus}
                  size="sm"
                  type="button"
                  variant="filled"
                >
                  Set max
                </Button>
              </div>
            </div>
            <Slider
              disabled={gpuExhausted}
              errorText={formik.touched.gpuCount && formik.errors.gpuCount ? formik.errors.gpuCount : undefined}
              hint={gpuFeeHint}
              label={`GPUs - ${unitCount} ${unitCount === 1 ? 'unit' : 'units'}`}
              marks
              max={Math.max(1, maxSelectableUnits)}
              min={1}
              name="gpuCount"
              onBlur={formik.handleBlur}
              onChange={formik.handleChange}
              step={1}
              topRight={gpuExhausted ? '0 available' : `1 - ${maxSelectableUnits} available`}
              value={formik.values.gpuCount}
              valueLabelFormat={(value) => (value === 1 ? `${value} unit` : `${value} units`)}
            />
          </>
        ) : (
          <p className={styles.wholeEnvNote}>
            This environment runs as a single unit. The full CPU, RAM, and disk capacity below is allocated to your job.
          </p>
        )}

        <div className={styles.derivedGrid}>
          {renderDerivedResource(
            'CPU',
            `${derivedCpu} ${derivedCpu === 1 ? 'core' : 'cores'}`,
            freeCompute ? 'Free' : `${cpuFee ?? 0} ${token?.symbol}/core`
          )}
          {renderDerivedResource('RAM', `${derivedRam} GB`, freeCompute ? 'Free' : `${ramFee ?? 0} ${token?.symbol}/GB`)}
          {renderDerivedResource(
            <div>
              Disk space{' '}
              <Tooltip title="The disk space should accommodate the container images, required datasets, temporary results, and final algorithm outputs">
                <InfoOutlinedIcon className="textAccent1" />
              </Tooltip>
            </div>,
            `${derivedDisk} GB`,
            freeCompute ? 'Free' : `${diskFee ?? 0} ${token?.symbol}/GB`
          )}
        </div>

        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit={selectedMaxJobDurationSeconds ? 'seconds' : 'hours'}
          errorText={
            formik.touched.maxJobDurationSeconds && formik.errors.maxJobDurationSeconds
              ? formik.errors.maxJobDurationSeconds
              : undefined
          }
          label="Max job duration"
          min={0}
          name="maxJobDurationSeconds"
          onBlur={formik.handleBlur}
          onChange={(seconds) => formik.setFieldValue('maxJobDurationSeconds', seconds)}
          onSetMax={setMaxJobDuration}
          topRight={`${formatDuration(minAllowedJobDurationSeconds, true)} - ${formatDuration(maxAllowedJobDurationSeconds, true)}`}
          value={formik.values.maxJobDurationSeconds}
        />

        {freeCompute ? null : (
          <TransitionGroup>
            {initComputeError ? <Collapse>{renderConnectionErrorCard()}</Collapse> : null}
            {!initComputeError && formik.isValid && !resourcesExhausted ? <Collapse>{renderCostCard()}</Collapse> : null}
          </TransitionGroup>
        )}
        <div className="actionsGroupLgBetween">
          <Button
            color="accent1"
            onClick={() => router.replace('/run-job/environments')}
            size="lg"
            type="button"
            variant="transparent"
          >
            Change environment
          </Button>
          <Button disabled={!isCostEstimated || resourcesExhausted} color="accent1" size="lg" type="submit">
            Continue
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default SelectResources;
