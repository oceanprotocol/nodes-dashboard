import Button from '@/components/button/button';
import Card from '@/components/card/card';
import useEnvResources from '@/components/hooks/use-env-resources';
import DurationInput from '@/components/input/duration-input';
import Input from '@/components/input/input';
import Slider from '@/components/slider/slider';
import config from '@/config';
import { SelectedToken, useRunJobContext } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration, formatTokenAmount, roundTokenAmount } from '@/utils/formatters';
import { capacityOf } from '@/utils/resources';
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

// 'package': pick a GPU count, CPU/RAM/disk are auto-derived as a proportional slice (read-only).
// 'custom': GPU count still applies, but CPU/RAM/disk are set by hand within what's available.
type ResourceMode = 'package' | 'custom';

type ResourcesFormValues = {
  cpuCores: number;
  diskSpace: number | '';
  gpus: string[];
  maxJobDurationSeconds: number;
  mode: ResourceMode;
  ram: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// How many whole GPU-sized units fit into the currently available amount of a resource.
// per <= 0 (resource not advertised) imposes no limit.
const unitsThatFit = (available: number, per: number) =>
  per > 0 ? Math.floor(Math.max(0, available) / per) : Number.POSITIVE_INFINITY;

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

  // The environment is split into equal GPU-sized parts: each selected GPU grants one proportional
  // share of CPU/RAM/disk. Nodes expose one resource entry per physical GPU (each total: 1), so the
  // number of GPU units equals the number of selected GPU entries.
  const hasGpu = gpus.length > 0;

  // Total physical GPU slots across all GPU resource entries the node advertises.
  // No-GPU environments behave as a single, whole-environment unit.
  const totalUnits = hasGpu
    ? Math.max(
        1,
        gpus.reduce((total, gpu) => total + capacityOf(gpu), 0)
      )
    : 1;
  // Every advertised GPU is currently in use elsewhere — nothing left to pick.
  const gpuExhausted = hasGpu && gpus.every((gpu) => (gpusAvailable[gpu.id] ?? 0) <= 0);

  // Per-unit (per-GPU) share of each resource, derived from full env capacity / total units.
  const perUnitCpu = capacityOf(cpu) / totalUnits;
  const perUnitRam = capacityOf(ram) / totalUnits;
  const perUnitDisk = capacityOf(disk) / totalUnits;

  const minAllowedCpuCores = cpu?.min ?? (cpu ? 1 : 0);
  const minAllowedRam = ram?.min ?? 0;
  const minAllowedDiskSpace = disk?.min ?? 0;
  const minAllowedJobDurationSeconds = minJobDurationSeconds ?? 0;

  const maxAllowedCpuCores = Math.max(minAllowedCpuCores, cpuAvailable);
  const maxAllowedRam = Math.max(minAllowedRam, ramAvailable);
  const maxAllowedDiskSpace = Math.max(minAllowedDiskSpace, diskAvailable);
  const maxAllowedJobDurationSeconds = maxJobDurationSeconds ?? 0;

  // A resource is exhausted when even its per-job minimum no longer fits in what's free.
  const cpuExhausted = !!cpu && cpuAvailable < minAllowedCpuCores;
  const ramExhausted = !!ram && ramAvailable < minAllowedRam;
  const diskExhausted = !!disk && diskAvailable < minAllowedDiskSpace;

  // Another tenant's custom job can leave plenty of GPUs free but too little CPU/RAM/disk to back
  // them. A package's slice is proportional, so cap the selectable GPU count to however many whole
  // units still fit in every shared resource.
  const maxUnitsByResources = Math.min(
    unitsThatFit(cpuAvailable, perUnitCpu),
    unitsThatFit(ramAvailable, perUnitRam),
    unitsThatFit(diskAvailable, perUnitDisk)
  );

  // Physical GPUs that share a description are the same model. Group them so the user picks a count
  // per model instead of ticking individual cards. availableIds keeps declared order, so a chosen
  // count maps deterministically to concrete resource ids.
  const gpuGroups = useMemo(() => {
    const byDescription = new Map<string, { description: string; fee?: number; availableIds: string[]; total: number }>();
    for (const gpu of gpus) {
      const description = gpu.description ?? gpu.id;
      let group = byDescription.get(description);
      if (!group) {
        group = { description, fee: gpuFees[gpu.id], availableIds: [], total: 0 };
        byDescription.set(description, group);
      }
      group.total += 1;
      if ((gpusAvailable[gpu.id] ?? 0) > 0) {
        group.availableIds.push(gpu.id);
      }
    }
    return [...byDescription.values()];
  }, [gpus, gpusAvailable, gpuFees]);

  const totalAvailableGpus = gpuGroups.reduce((sum, group) => sum + group.availableIds.length, 0);

  const selectedGpuIds = selectedResources?.gpus?.map((g) => g.id);
  const selectedCpu = selectedResources?.cpuCores;
  const selectedDisk = selectedResources?.diskSpace;
  const selectedRam = selectedResources?.ram;
  const selectedMaxJobDurationSeconds = selectedResources?.maxJobDurationSeconds;

  // Reconstruct what the package slice would be for the hydrated GPU count; if the stored CPU/RAM/disk
  // differ, the previous selection was custom, so reopen in custom mode (e.g. back-nav from payment).
  const initialGpus = (selectedGpuIds ?? []).filter((id) => (gpusAvailable[id] ?? 0) > 0);
  const initialUnitCount = hasGpu ? initialGpus.length : 1;
  const packageCpu = clamp(Math.round(perUnitCpu * initialUnitCount), minAllowedCpuCores, maxAllowedCpuCores);
  const packageRam = clamp(Math.round(perUnitRam * initialUnitCount), minAllowedRam, maxAllowedRam);
  const packageDisk = clamp(Math.round(perUnitDisk * initialUnitCount), minAllowedDiskSpace, maxAllowedDiskSpace);
  const hydratedCustom =
    (selectedCpu != null && selectedCpu !== packageCpu) ||
    (selectedRam != null && selectedRam !== packageRam) ||
    (selectedDisk != null && selectedDisk !== packageDisk);

  const formik = useFormik<ResourcesFormValues>({
    enableReinitialize: true,
    initialValues: {
      cpuCores: clamp(selectedCpu ?? packageCpu, minAllowedCpuCores, maxAllowedCpuCores),
      diskSpace: clamp(selectedDisk ?? packageDisk, minAllowedDiskSpace, maxAllowedDiskSpace),
      gpus: initialGpus,
      maxJobDurationSeconds: selectedMaxJobDurationSeconds ?? minAllowedJobDurationSeconds,
      mode: hydratedCustom ? 'custom' : 'package',
      ram: clamp(selectedRam ?? packageRam, minAllowedRam, maxAllowedRam),
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
        cpuCores: effectiveCpu,
        cpuId: cpu?.id ?? 'cpu',
        diskSpace: effectiveDisk,
        diskId: disk?.id ?? 'disk',
        gpus: selectedGpuEntries,
        gpuCount: selectedGpuEntries.length,
        maxJobDurationSeconds: values.maxJobDurationSeconds,
        ram: effectiveRam,
        ramId: ram?.id ?? 'ram',
      });
      posthog.capture('environment_configured', {
        cpuCores: effectiveCpu,
        ram: effectiveRam,
        diskSpace: effectiveDisk,
        gpuCount: selectedGpuEntries.length,
        maxJobDurationSeconds: values.maxJobDurationSeconds,
        mode: values.mode,
        estimatedTotalCost,
        freeCompute,
      });
      const query = {
        ...router.query,
        cpu: effectiveCpu,
        ram: effectiveRam,
        disk: effectiveDisk,
        ...(values.gpus.length > 0 && {
          gpus: values.gpus.map((id) => `${id}:1`),
          gpuCount: values.gpus.length,
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
      cpuCores: Yup.number().when('mode', {
        is: 'custom',
        then: (schema) =>
          schema
            .required('Required')
            .min(minAllowedCpuCores, 'Limits exceeded')
            .max(maxAllowedCpuCores, cpuExhausted ? 'Not enough available' : 'Limits exceeded')
            .integer('Invalid format'),
        otherwise: (schema) => schema.notRequired(),
      }),
      diskSpace: Yup.number().when('mode', {
        is: 'custom',
        then: (schema) =>
          schema
            .required('Required')
            .min(minAllowedDiskSpace, 'Limits exceeded')
            .max(maxAllowedDiskSpace, diskExhausted ? 'Not enough available' : 'Limits exceeded'),
        otherwise: (schema) => schema.notRequired(),
      }),
      gpus: Yup.array()
        .of(Yup.string())
        // GPUs are optional — a job with none gets the minimum CPU/RAM/disk slice.
        .test('gpus-available', 'One or more selected GPUs are no longer available', (value) =>
          (value ?? []).every((id) => (id ? (gpusAvailable[id] ?? 0) > 0 : true))
        ),
      maxJobDurationSeconds: Yup.number()
        .required('Required')
        .min(minAllowedJobDurationSeconds, 'Limits exceeded')
        .max(maxAllowedJobDurationSeconds, 'Limits exceeded'),
      ram: Yup.number().when('mode', {
        is: 'custom',
        then: (schema) =>
          schema
            .required('Required')
            .min(minAllowedRam, 'Limits exceeded')
            .max(maxAllowedRam, ramExhausted ? 'Not enough available' : 'Limits exceeded'),
        otherwise: (schema) => schema.notRequired(),
      }),
    }),
  });

  const isCustom = formik.values.mode === 'custom';

  // Each selected GPU is one unit; no-GPU envs run as a single whole-environment unit.
  const unitCount = hasGpu ? formik.values.gpus.length : 1;

  // The GPU resource entries the user picked, one unit each.
  const selectedGpuEntries = useMemo(
    () =>
      gpus
        .filter((gpu) => formik.values.gpus.includes(gpu.id))
        .map((gpu) => ({ id: gpu.id, description: gpu.description, amount: 1 })),
    [gpus, formik.values.gpus]
  );

  // Package-mode CPU/RAM/disk: the proportional slice for the chosen unit count, clamped to available.
  const derivedCpu = clamp(Math.round(perUnitCpu * unitCount), minAllowedCpuCores, maxAllowedCpuCores);
  const derivedRam = clamp(Math.round(perUnitRam * unitCount), minAllowedRam, maxAllowedRam);
  const derivedDisk = clamp(Math.round(perUnitDisk * unitCount), minAllowedDiskSpace, maxAllowedDiskSpace);

  // What the job actually requests: hand-set values in custom mode, the derived slice otherwise.
  const effectiveCpu = isCustom ? formik.values.cpuCores : derivedCpu;
  const effectiveRam = isCustom ? formik.values.ram : derivedRam;
  const effectiveDisk = isCustom ? Number(formik.values.diskSpace) || 0 : derivedDisk;

  // Cap on total GPU units the pills allow. Package mode additionally caps by the shared resources
  // left behind by other jobs; custom mode caps only by physically free GPUs.
  const maxSelectableUnits = isCustom ? totalAvailableGpus : Math.min(totalAvailableGpus, maxUnitsByResources);

  const resourcesExhausted = gpuExhausted || cpuExhausted || ramExhausted || diskExhausted;

  const resources = useMemo(() => {
    const list = [
      { id: cpu?.id ?? 'cpu', amount: effectiveCpu },
      { id: disk?.id ?? 'disk', amount: effectiveDisk },
      { id: ram?.id ?? 'ram', amount: effectiveRam },
    ];
    for (const gpu of selectedGpuEntries) {
      list.push({ id: gpu.id, amount: gpu.amount });
    }
    return list;
  }, [cpu?.id, disk?.id, ram?.id, selectedGpuEntries, effectiveCpu, effectiveRam, effectiveDisk]);

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

  const setMaxJobDuration = () => {
    formik.setFieldValue('maxJobDurationSeconds', maxAllowedJobDurationSeconds);
  };

  const setMaxDiskSpace = () => {
    formik.setFieldValue('diskSpace', maxAllowedDiskSpace);
  };

  const handleDiskSpaceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value === '') {
      formik.setFieldValue('diskSpace', '');
      return;
    }
    formik.setFieldValue('diskSpace', Math.max(0, Number(e.target.value)));
  };

  // Switching to custom seeds the sliders with the current derived slice so the values stay
  // continuous; switching back to package lets the derived slice take over again.
  const setMode = (mode: ResourceMode) => {
    if (mode === 'custom') {
      formik.setValues((prev) => ({ ...prev, mode, cpuCores: derivedCpu, ram: derivedRam, diskSpace: derivedDisk }));
    } else {
      formik.setFieldValue('mode', 'package');
    }
  };

  const selectAllGpus = () => {
    const available = gpus.filter((gpu) => (gpusAvailable[gpu.id] ?? 0) > 0).map((gpu) => gpu.id);
    const cap = Number.isFinite(maxSelectableUnits) ? Math.min(available.length, maxSelectableUnits) : available.length;
    formik.setFieldValue('gpus', available.slice(0, cap));
  };

  // Replace one model group's selection with its first `count` available cards, leaving the
  // selections of other groups untouched.
  const setGroupCount = (availableIds: string[], count: number) => {
    const others = formik.values.gpus.filter((id) => !availableIds.includes(id));
    formik.setFieldValue('gpus', [...others, ...availableIds.slice(0, count)]);
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

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.titleRow}>
        <h3>Select resources</h3>
        <div className={styles.modeToggle} role="group" aria-label="Resource selection mode">
          <button
            aria-pressed={!isCustom}
            className={`${styles.modeButton} ${!isCustom ? styles.modeButtonActive : ''}`}
            onClick={() => setMode('package')}
            type="button"
          >
            Package
          </button>
          <button
            aria-pressed={isCustom}
            className={`${styles.modeButton} ${isCustom ? styles.modeButtonActive : ''}`}
            onClick={() => setMode('custom')}
            type="button"
          >
            Custom
          </button>
        </div>
      </div>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        {hasGpu ? (
          <div className={styles.gpuGroups}>
            <div className={styles.gpuHeader}>
              <label className={styles.gpuGroupsLabel}>GPUs</label>
              <Button
                color="accent2"
                disabled={gpuExhausted}
                onClick={selectAllGpus}
                size="sm"
                type="button"
                variant="filled"
              >
                Select all
              </Button>
            </div>
            {gpuGroups.map((group) => {
              const available = group.availableIds.length;
              const count = group.availableIds.filter((id) => formik.values.gpus.includes(id)).length;
              const selectedElsewhere = formik.values.gpus.length - count;
              const pricing = freeCompute ? 'Free' : `${group.fee ?? ''} ${token?.symbol}/unit`;
              return (
                <div className={styles.gpuGroup} key={group.description}>
                  <div className={styles.gpuGroupTop}>
                    <span className={styles.gpuGroupName}>{group.description}</span>
                    <span className={styles.gpuGroupFee}>{pricing}</span>
                  </div>
                  {available > 0 ? (
                    <>
                      <div className={styles.pills} role="group" aria-label={group.description}>
                        {Array.from({ length: available + 1 }, (_, n) => {
                          // Disabled when it would exceed this model's free cards, or when the running
                          // total would outstrip the units the shared resources can still back.
                          const disabled = n > available || selectedElsewhere + n > maxSelectableUnits;
                          return (
                            <button
                              aria-pressed={n === count}
                              className={`${styles.pill} ${n === count ? styles.pillSelected : ''}`}
                              disabled={disabled && n !== count}
                              key={n}
                              onClick={() => setGroupCount(group.availableIds, n)}
                              type="button"
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                      <div className={styles.gpuGroupMeta}>
                        {available} of {group.total} available
                      </div>
                    </>
                  ) : (
                    <div className={styles.gpuGroupMeta}>None available</div>
                  )}
                </div>
              );
            })}
            {formik.touched.gpus && formik.errors.gpus ? (
              <div className={styles.gpuError}>{formik.errors.gpus as string}</div>
            ) : null}
          </div>
        ) : !isCustom ? (
          <p className={styles.wholeEnvNote}>
            This environment runs as a single unit. The full CPU, RAM, and disk capacity below is allocated to your job.
          </p>
        ) : null}

        {isCustom ? (
          <div className={styles.inputsGrid}>
            <Slider
              disabled={cpuExhausted}
              errorText={formik.touched.cpuCores && formik.errors.cpuCores ? formik.errors.cpuCores : undefined}
              hint={freeCompute ? 'Free' : `${cpuFee ?? 0} ${token?.symbol}/core`}
              label={`CPU - ${formik.values.cpuCores} ${formik.values.cpuCores === 1 ? 'core' : 'cores'}`}
              marks
              max={maxAllowedCpuCores}
              min={minAllowedCpuCores}
              name="cpuCores"
              onBlur={formik.handleBlur}
              onChange={formik.handleChange}
              step={1}
              topRight={cpuExhausted ? '0 available' : `${minAllowedCpuCores} - ${maxAllowedCpuCores} available`}
              value={formik.values.cpuCores}
              valueLabelFormat={(value) => (value === 1 ? `${value} core` : `${value} cores`)}
            />
            <Slider
              disabled={ramExhausted}
              errorText={formik.touched.ram && formik.errors.ram ? formik.errors.ram : undefined}
              hint={freeCompute ? 'Free' : `${ramFee ?? 0} ${token?.symbol}/GB`}
              label={`RAM - ${formik.values.ram} GB`}
              marks
              max={maxAllowedRam}
              min={minAllowedRam}
              name="ram"
              onBlur={formik.handleBlur}
              onChange={formik.handleChange}
              step={1}
              topRight={ramExhausted ? '0 GB available' : `${minAllowedRam} - ${maxAllowedRam} GB available`}
              value={formik.values.ram}
              valueLabelFormat={(value) => `${value} GB`}
            />
            <Input
              endAdornment={
                <Button color="accent2" onClick={setMaxDiskSpace} size="sm" type="button" variant="filled">
                  Set max
                </Button>
              }
              errorText={formik.touched.diskSpace && formik.errors.diskSpace ? formik.errors.diskSpace : undefined}
              hint={freeCompute ? 'Free' : `${diskFee ?? 0} ${token?.symbol}/GB`}
              label={
                <div>
                  Disk space{' '}
                  <Tooltip title="The disk space should accommodate the container images, required datasets, temporary results, and final algorithm outputs">
                    <InfoOutlinedIcon className="textAccent1" />
                  </Tooltip>
                </div>
              }
              max={maxAllowedDiskSpace}
              min={0}
              name="diskSpace"
              onBlur={formik.handleBlur}
              onChange={handleDiskSpaceChange}
              startAdornment="GB"
              topRight={`${minAllowedDiskSpace} - ${maxAllowedDiskSpace} available`}
              type="number"
              value={formik.values.diskSpace}
            />
          </div>
        ) : (
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
        )}

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
            {!initComputeError && formik.isValid && !resourcesExhausted ? (
              <Collapse>{renderCostCard()}</Collapse>
            ) : null}
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
