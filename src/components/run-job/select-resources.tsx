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
import { ComputeEnvironment, ComputeResource } from '@/types/environments';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration, formatTokenAmount, roundTokenAmount } from '@/utils/formatters';
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

// Full env capacity for a resource. Prefer `total` (whole-env capacity); fall back to `max`.
const capacityOf = (resource?: ComputeResource) => {
  const total = resource?.total ?? 0;
  return total > 0 ? total : (resource?.max ?? 0);
};

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

  // Environments expose a single GPU type. The environment is split into equal parts,
  // one part per GPU unit: picking N GPUs grants N proportional shares of CPU/RAM/disk.
  const gpuRes = gpus[0];
  const hasGpu = !!gpuRes;
  if (gpus.length > 1) {
    // The UI only models one GPU type; surface a warning if a node ever advertises several so the
    // dropped types (and the resulting wrong cost) don't go unnoticed.
    console.warn(`Environment exposes ${gpus.length} GPU types; only "${gpuRes.id}" is selectable.`);
  }

  // Number of equal parts the environment is divided into (its full GPU capacity).
  // No-GPU environments behave as a single, whole-environment unit.
  const totalUnits = hasGpu ? Math.max(1, capacityOf(gpuRes)) : 1;
  const availableGpuUnits = hasGpu ? (gpusAvailable[gpuRes.id] ?? 0) : 1;
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
        gpus: hasGpu ? [{ id: gpuRes.id, description: gpuRes.description }] : [],
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
        ...(hasGpu && { gpus: gpuRes.id, gpuCount: values.gpuCount }),
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
    if (hasGpu) {
      list.push({ id: gpuRes.id, amount: unitCount });
    }
    return list;
  }, [cpu?.id, disk?.id, ram?.id, gpuRes?.id, hasGpu, derivedCpu, derivedRam, derivedDisk, unitCount]);

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

  const gpuFeeHint = hasGpu
    ? freeCompute
      ? 'Free'
      : `${gpuFees[gpuRes.id] ?? 0} ${token?.symbol}/unit`
    : '';

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Select resources</h3>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        {hasGpu ? (
          <>
            <div className={styles.gpuHeader}>
              <GpuLabel gpu={gpuRes.description} />
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
