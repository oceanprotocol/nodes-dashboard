import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Slider from '@/components/slider/slider';
import { SelectedToken, useRunJobContext } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { DURATION_UNIT_OPTIONS, type DurationUnit, fromSeconds, toSeconds } from '@/utils/duration';
import { formatTokenAmount, roundTokenAmount } from '@/utils/formatters';
import { useAuthModal } from '@account-kit/react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress, Collapse, Tooltip } from '@mui/material';
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
  cpuCores: number;
  diskSpace: number | '';
  gpus: string[];
  maxJobDurationUnit: DurationUnit;
  maxJobDurationValue: number | '';
  ram: number;
};

const SelectResources = ({ environment, freeCompute, token }: SelectResourcesProps) => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();
  const router = useRouter();

  const { account } = useOceanAccount();

  const {
    estimatedTotalCost,
    fetchEstimatedCost,
    multiaddrsOrPeerId,
    selectedResources,
    setEstimatedTotalCost,
    setSelectedResources,
  } = useRunJobContext();

  const { node: p2pNode } = useP2P();

  const [initComputeError, setInitComputeError] = useState<unknown | null>(null);
  const [isLoadingCost, setIsLoadingCost] = useState(false);

  const costEstimateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ESTIMATE_COST_DEBOUNCE_MS = 800;

  const isCostEstimated = !isLoadingCost && (estimatedTotalCost || estimatedTotalCost === 0) && !initComputeError;

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, maxJobDurationSeconds, minJobDurationSeconds, ram, ramFee } =
    useEnvResources({
      environment,
      freeCompute,
      tokenAddress: token?.address ?? '',
    });

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

  const minAllowedCpuCores = cpu?.min ?? 1;
  const minAllowedDiskSpace = disk?.min ?? 0;
  const minAllowedJobDurationSeconds = minJobDurationSeconds ?? 0;
  const minAllowedRam = ram?.min ?? 0;

  const maxAllowedCpuCores = cpu?.max ?? minAllowedCpuCores;
  const maxAllowedDiskSpace = disk?.max ?? minAllowedDiskSpace;
  const maxAllowedJobDurationSeconds = maxJobDurationSeconds ?? 0;
  const maxAllowedRam = ram?.max ?? minAllowedRam;

  const selectedCpu = selectedResources?.cpuCores;
  const selectedDisk = selectedResources?.diskSpace;
  const selectedRam = selectedResources?.ram;
  const selectedGpus = selectedResources?.gpus.map((gpu) => gpu.id);
  const selectedMaxJobDurationSeconds = selectedResources?.maxJobDurationSeconds;

  const formik = useFormik<ResourcesFormValues>({
    enableReinitialize: true,
    initialValues: {
      cpuCores: selectedCpu ?? minAllowedCpuCores,
      diskSpace: selectedDisk ?? minAllowedDiskSpace,
      gpus: selectedGpus ?? [],
      maxJobDurationUnit: (selectedMaxJobDurationSeconds ? 'seconds' : 'hours') as DurationUnit,
      maxJobDurationValue: selectedMaxJobDurationSeconds || fromSeconds(minAllowedJobDurationSeconds, 'hours'),
      ram: selectedRam ?? minAllowedRam,
    },
    onSubmit: (values) => {
      if (!account?.isConnected) {
        openAuthModal();
        return;
      }
      if (!freeCompute && !estimatedTotalCost) {
        return;
      }
      setEstimatedTotalCost(
        estimatedTotalCost && token?.address ? roundTokenAmount(estimatedTotalCost, token.address, 'up') : 0
      );
      setSelectedResources({
        cpuCores: values.cpuCores,
        cpuId: cpu?.id ?? 'cpu',
        diskSpace: Number(values.diskSpace) || 0,
        diskId: disk?.id ?? 'disk',
        gpus: gpus
          .filter((gpu) => values.gpus.includes(gpu.id))
          .map((gpu) => ({ id: gpu.id, description: gpu.description })),
        maxJobDurationSeconds: toSeconds(Number(values.maxJobDurationValue) || 0, values.maxJobDurationUnit),
        ram: values.ram,
        ramId: ram?.id ?? 'ram',
      });
      posthog.capture('environment_configured', {
        cpuCores: values.cpuCores,
        ram: values.ram,
        diskSpace: Number(values.diskSpace) || 0,
        gpus: values.gpus,
        maxJobDurationSeconds: toSeconds(Number(values.maxJobDurationValue) || 0, values.maxJobDurationUnit),
        estimatedTotalCost,
        freeCompute,
      });
      const query = {
        ...router.query,
        cpu: values.cpuCores,
        ram: values.ram,
        disk: values.diskSpace,
        ...(values.gpus.length > 0 && { gpus: values.gpus }),
        maxJobDuration: toSeconds(Number(values.maxJobDurationValue) || 0, values.maxJobDurationUnit),
      };

      if (estimatedTotalCost! > 0 && !freeCompute) {
        router.push({ pathname: '/run-job/payment', query });
      } else {
        router.push({ pathname: '/run-job/summary', query });
      }
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      cpuCores: Yup.number()
        .required('Required')
        .min(minAllowedCpuCores, 'Limits exceeded')
        .max(maxAllowedCpuCores, 'Limits exceeded')
        .integer('Invalid format'),
      diskSpace: Yup.number()
        .required('Required')
        .min(minAllowedDiskSpace, 'Limits exceeded')
        .max(maxAllowedDiskSpace, 'Limits exceeded'),
      gpus: Yup.array().of(Yup.string()),
      maxJobDurationValue: Yup.number()
        .required('Required')
        .test('duration-range', 'Limits exceeded', function (value) {
          if (value == null || Number.isNaN(value)) return false;
          const sec = toSeconds(value, this.parent.maxJobDurationUnit);
          return sec >= minAllowedJobDurationSeconds && sec <= maxAllowedJobDurationSeconds;
        }),
      ram: Yup.number()
        .required('Required')
        .min(minAllowedRam, 'Limits exceeded')
        .max(maxAllowedRam, 'Limits exceeded'),
    }),
  });

  const resources = useMemo(
    () => [
      { id: cpu?.id ?? 'cpu', amount: formik.values.cpuCores },
      { id: disk?.id ?? 'disk', amount: Number(formik.values.diskSpace) || 0 },
      { id: ram?.id ?? 'ram', amount: formik.values.ram },
      ...formik.values.gpus.map((gpuId) => ({ id: gpuId, amount: 1 })),
    ],
    [cpu?.id, disk?.id, ram?.id, formik.values.cpuCores, formik.values.diskSpace, formik.values.ram, formik.values.gpus]
  );

  const estimateCost = useCallback(async () => {
    setIsLoadingCost(true);
    setInitComputeError(null);
    const maxJobDurationSec = toSeconds(
      Number(formik.values.maxJobDurationValue) || 0,
      formik.values.maxJobDurationUnit
    );
    await fetchEstimatedCost({
      environment,
      freeCompute,
      maxJobDurationSeconds: maxJobDurationSec < 1 ? 1 : Math.ceil(maxJobDurationSec),
      multiaddrsOrPeerId,
      onError: (error) => setInitComputeError(error),
      resources,
      tokenAddress: token?.address,
    });
    setIsLoadingCost(false);
  }, [
    fetchEstimatedCost,
    environment,
    freeCompute,
    formik.values.maxJobDurationValue,
    formik.values.maxJobDurationUnit,
    multiaddrsOrPeerId,
    resources,
    token,
  ]);

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
  }, [estimateCost, fetchEstimatedCost]);

  const selectAllGpus = () => {
    formik.setFieldValue(
      'gpus',
      gpus.map((gpu) => gpu.id)
    );
  };

  const setMaxDiskSpace = () => {
    formik.setFieldValue('diskSpace', maxAllowedDiskSpace);
  };

  const setMaxJobDuration = () => {
    formik.setValues((prev) => ({
      ...prev,
      maxJobDurationValue: fromSeconds(maxAllowedJobDurationSeconds, prev.maxJobDurationUnit),
    }));
  };

  const handleDurationUnitChange = (newUnit: DurationUnit) => {
    const currentSec = toSeconds(Number(formik.values.maxJobDurationValue) || 0, formik.values.maxJobDurationUnit);
    formik.setValues((prev) => ({
      ...prev,
      maxJobDurationUnit: newUnit,
      maxJobDurationValue: fromSeconds(currentSec, newUnit),
    }));
  };

  const handleDiskSpaceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value === '') {
      formik.setFieldValue('diskSpace', '');
      return;
    }
    const num = Number(e.target.value);
    formik.setFieldValue('diskSpace', Math.max(0, num));
  };

  const handleMaxJobDurationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value === '') {
      formik.setFieldValue('maxJobDurationValue', '');
      return;
    }
    const num = Number(e.target.value);
    formik.setFieldValue('maxJobDurationValue', Math.max(0, num));
  };

  const renderCostEstimation = () => {
    if (isLoadingCost) {
      return (
        <h3 className={styles.estimationMessage}>
          <CircularProgress size={24} />
          Estimating cost...
        </h3>
      );
    }
    if (!!initComputeError || !token) {
      let errorText;
      if (initComputeError instanceof Error) {
        errorText = initComputeError.message;
      }
      return (
        <h3 className={styles.estimationMessage}>
          Cost estimation failed{' '}
          {errorText ? (
            <Tooltip className="textAccent1" title={errorText}>
              <InfoOutlinedIcon className={styles.accessInfoIcon} />
            </Tooltip>
          ) : null}
        </h3>
      );
    }
    if (!p2pNode || (!estimatedTotalCost && estimatedTotalCost !== 0)) {
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
        <span className={styles.amount}>{formatTokenAmount(estimatedTotalCost, token.address)}</span>
      </div>
    );
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Select resources</h3>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <Select
          endAdornment={
            <Button color="accent2" onClick={selectAllGpus} size="sm" type="button" variant="filled">
              Select all
            </Button>
          }
          errorText={formik.touched.gpus && formik.errors.gpus ? formik.errors.gpus : undefined}
          label="GPUs"
          multiple
          name="gpus"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          options={gpus.map((gpu) => ({ label: gpu.description ?? '', value: gpu.id }))}
          placeholder="No GPU selected"
          renderOption={(option) => {
            const pricing = freeCompute ? 'Free' : `${gpuFees[option.value] ?? ''} ${token?.symbol}/min`;
            return <GpuLabel gpu={`${option.label} (${pricing})`} />;
          }}
          renderSelectedValue={(option) => <GpuLabel gpu={option} />}
          value={formik.values.gpus}
        />
        <div className={styles.inputsGrid}>
          <Slider
            errorText={formik.touched.cpuCores && formik.errors.cpuCores ? formik.errors.cpuCores : undefined}
            hint={freeCompute ? 'Free' : `${cpuFee ?? 0} ${token?.symbol}/core`}
            label={`CPU - ${formik.values.cpuCores} ${formik.values.cpuCores === 1 ? 'core' : 'cores'}`}
            name="cpuCores"
            marks
            max={maxAllowedCpuCores}
            min={minAllowedCpuCores}
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            step={1}
            topRight={`${minAllowedCpuCores}-${maxAllowedCpuCores}`}
            value={formik.values.cpuCores}
            valueLabelFormat={(value) => (value === 1 ? `${value} core` : `${value} cores`)}
          />
          <Slider
            errorText={formik.touched.ram && formik.errors.ram ? formik.errors.ram : undefined}
            hint={freeCompute ? 'Free' : `${ramFee ?? 0} ${token?.symbol}/GB`}
            label={`RAM - ${formik.values.ram} GB`}
            name="ram"
            marks
            max={maxAllowedRam}
            min={minAllowedRam}
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            step={1}
            topRight={`${minAllowedRam}-${maxAllowedRam}`}
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
            topRight={`${minAllowedDiskSpace}-${maxAllowedDiskSpace}`}
            type="number"
            value={formik.values.diskSpace}
          />
          <Input
            endAdornment={
              <div className={styles.durationControls}>
                <select
                  aria-label="Duration unit"
                  className={styles.unitSelect}
                  name="maxJobDurationUnit"
                  onBlur={formik.handleBlur}
                  onChange={(e) => {
                    const newUnit = (e.target.value ?? 'minutes') as DurationUnit;
                    handleDurationUnitChange(newUnit);
                  }}
                  value={formik.values.maxJobDurationUnit}
                >
                  {DURATION_UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button color="accent2" onClick={setMaxJobDuration} size="sm" type="button" variant="filled">
                  Set max
                </Button>
              </div>
            }
            errorText={
              formik.touched.maxJobDurationValue && formik.errors.maxJobDurationValue
                ? formik.errors.maxJobDurationValue
                : undefined
            }
            label="Max job duration"
            min={0}
            name="maxJobDurationValue"
            onBlur={formik.handleBlur}
            onChange={handleMaxJobDurationChange}
            topRight={`${Math.ceil(fromSeconds(minAllowedJobDurationSeconds, formik.values.maxJobDurationUnit))}-${Math.ceil(fromSeconds(maxAllowedJobDurationSeconds, formik.values.maxJobDurationUnit))}`}
            type="number"
            value={formik.values.maxJobDurationValue}
          />
        </div>
        <TransitionGroup>
          {formik.isValid && !freeCompute ? (
            <Collapse>
              <Card className={styles.costCard} innerShadow="black" radius="md" variant="glass">
                <div className={styles.costEstimation}>
                  <h3>Estimated total cost</h3>
                  {renderCostEstimation()}
                </div>
                <div className="alignSelfEnd textSuccessDarker">
                  If your job finishes earlier than estimated, the unconsumed tokens remain in your escrow
                </div>
              </Card>
            </Collapse>
          ) : null}
        </TransitionGroup>
        <div className={styles.buttons}>
          <Button
            color="accent1"
            onClick={() => router.replace('/run-job/environments')}
            size="lg"
            type="button"
            variant="transparent"
          >
            Change environment
          </Button>
          <Button disabled={!isCostEstimated} color="accent1" size="lg" type="submit">
            Continue
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default SelectResources;
