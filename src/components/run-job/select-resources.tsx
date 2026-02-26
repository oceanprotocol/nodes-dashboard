import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Slider from '@/components/slider/slider';
import { CHAIN_ID } from '@/constants/chains';
import { SelectedToken, useRunJobContext } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { DURATION_UNIT_OPTIONS, type DurationUnit, fromSeconds, toSeconds } from '@/utils/duration';
import { formatNumber } from '@/utils/formatters';
import { useAuthModal } from '@account-kit/react';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Yup from 'yup';
import styles from './select-resources.module.css';

type SelectResourcesProps = {
  environment: ComputeEnvironment;
  freeCompute: boolean;
  token: SelectedToken;
};

type ResourcesFormValues = {
  cpuCores: number;
  diskSpace: number;
  gpus: string[];
  maxJobDurationUnit: DurationUnit;
  maxJobDurationValue: number;
  ram: number;
};

const SelectResources = ({ environment, freeCompute, token }: SelectResourcesProps) => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();
  const router = useRouter();

  const { account } = useOceanAccount();

  const { nodeInfo, multiaddrsOrPeerId, setEstimatedTotalCost, setMinLockSeconds, setSelectedResources } =
    useRunJobContext();

  const { initializeCompute } = useP2P();
  const { provider } = useOceanAccount();

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee } = useEnvResources({
    environment,
    freeCompute,
    tokenAddress: token.address,
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
  const minAllowedJobDurationSeconds = environment.minJobDuration ?? 0;
  const minAllowedRam = ram?.min ?? 0;

  const maxAllowedCpuCores = cpu?.max ?? minAllowedCpuCores;
  const maxAllowedDiskSpace = disk?.max ?? minAllowedDiskSpace;
  const maxAllowedJobDurationSeconds = environment.maxJobDuration ?? environment.minJobDuration ?? 0;
  const maxAllowedRam = ram?.max ?? minAllowedRam;

  const formik = useFormik<ResourcesFormValues>({
    initialValues: {
      cpuCores: minAllowedCpuCores,
      diskSpace: minAllowedDiskSpace,
      gpus: [],
      maxJobDurationUnit: 'hours' as DurationUnit,
      maxJobDurationValue: fromSeconds(minAllowedJobDurationSeconds, 'hours'),
      ram: minAllowedRam,
    },
    onSubmit: (values) => {
      if (!account?.isConnected) {
        openAuthModal();
        return;
      }
      setEstimatedTotalCost(estimatedTotalCost);
      setSelectedResources({
        cpuCores: values.cpuCores,
        cpuId: cpu?.id ?? 'cpu',
        diskSpace: values.diskSpace,
        diskId: disk?.id ?? 'disk',
        gpus: gpus
          .filter((gpu) => values.gpus.includes(gpu.id))
          .map((gpu) => ({ id: gpu.id, description: gpu.description })),
        maxJobDurationSeconds: toSeconds(values.maxJobDurationValue, values.maxJobDurationUnit),
        ram: values.ram,
        ramId: ram?.id ?? 'ram',
      });
      posthog.capture('environment_configured', {
        cpuCores: values.cpuCores,
        ram: values.ram,
        diskSpace: values.diskSpace,
        gpus: values.gpus,
        maxJobDurationSeconds: toSeconds(values.maxJobDurationValue, values.maxJobDurationUnit),
        estimatedTotalCost,
        freeCompute,
      });
      if (estimatedTotalCost > 0 && !freeCompute) {
        router.push('/run-job/payment');
      } else {
        router.push('/run-job/summary');
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
          if (value == null) return false;
          const sec = toSeconds(value, this.parent.maxJobDurationUnit);
          return sec >= minAllowedJobDurationSeconds && sec <= maxAllowedJobDurationSeconds;
        }),
      ram: Yup.number()
        .required('Required')
        .min(minAllowedRam, 'Limits exceeded')
        .max(maxAllowedRam, 'Limits exceeded'),
    }),
  });

  const [estimatedTotalCost, setLocalEstimatedTotalCost] = useState(0);
  const [isLoadingCost, setIsLoadingCost] = useState(false);

  const resources = useMemo(
    () => [
      { id: cpu?.id ?? 'cpu', amount: formik.values.cpuCores },
      { id: disk?.id ?? 'disk', amount: formik.values.diskSpace },
      { id: ram?.id ?? 'ram', amount: formik.values.ram },
      ...formik.values.gpus.map((gpuId) => ({ id: gpuId, amount: 1 })),
    ],
    [cpu?.id, disk?.id, ram?.id, formik.values.cpuCores, formik.values.diskSpace, formik.values.ram, formik.values.gpus]
  );

  const fetchEstimatedCost = useCallback(async () => {
    if (freeCompute) {
      setLocalEstimatedTotalCost(0);
      return;
    }

    if (!provider || !nodeInfo?.id) {
      return;
    }

    setIsLoadingCost(true);
    try {
      const maxJobDurationSec = toSeconds(formik.values.maxJobDurationValue, formik.values.maxJobDurationUnit);
      const { cost, minLockSeconds } = await initializeCompute(
        environment,
        token.address,
        maxJobDurationSec < 1 ? 1 : Math.ceil(maxJobDurationSec),
        multiaddrsOrPeerId,
        environment.consumerAddress,
        resources,
        CHAIN_ID,
        provider
      );
      setLocalEstimatedTotalCost(Number(cost));
      setMinLockSeconds(minLockSeconds);
    } catch (error) {
      console.error('Failed to fetch estimated cost:', error);
    } finally {
      setIsLoadingCost(false);
    }
  }, [
    environment,
    freeCompute,
    formik.values.maxJobDurationValue,
    formik.values.maxJobDurationUnit,
    multiaddrsOrPeerId,
    nodeInfo?.id,
    initializeCompute,
    provider,
    resources,
    setMinLockSeconds,
    token.address,
  ]);

  useEffect(() => {
    fetchEstimatedCost();
  }, [fetchEstimatedCost]);

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
    const currentSec = toSeconds(formik.values.maxJobDurationValue, formik.values.maxJobDurationUnit);
    formik.setValues((prev) => ({
      ...prev,
      maxJobDurationUnit: newUnit,
      maxJobDurationValue: fromSeconds(currentSec, newUnit),
    }));
  };

  const handleDiskSpaceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Number(e.target.value);
    formik.setFieldValue('diskSpace', e.target.value === '' ? 0 : Math.max(0, num));
  };

  const handleMaxJobDurationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Number(e.target.value);
    formik.setFieldValue('maxJobDurationValue', e.target.value === '' ? 0 : Math.max(0, num));
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
            const pricing = freeCompute ? 'Free' : `${gpuFees[option.value] ?? ''} ${token.symbol}/min`;
            return <GpuLabel gpu={`${option.label} (${pricing})`} />;
          }}
          renderSelectedValue={(option) => <GpuLabel gpu={option} />}
          value={formik.values.gpus}
        />
        <div className={styles.inputsGrid}>
          <Slider
            errorText={formik.touched.cpuCores && formik.errors.cpuCores ? formik.errors.cpuCores : undefined}
            hint={freeCompute ? 'Free' : `${cpuFee ?? 0} ${token.symbol}/core`}
            label="CPU"
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
            hint={freeCompute ? 'Free' : `${ramFee ?? 0} ${token.symbol}/GB`}
            label="RAM"
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
            hint={freeCompute ? 'Free' : `${diskFee ?? 0} ${token.symbol}/GB`}
            label="Disk space"
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
        {formik.isValid && !freeCompute ? (
          <Card className={styles.cost} radius="md" variant="accent1-outline">
            <h3>Estimated total cost</h3>
            <div className={styles.values}>
              <div>
                <span className={styles.token}>{token.symbol}</span>
                &nbsp;
                <span className={styles.amount}>
                  {isLoadingCost ? 'Calculating...' : formatNumber(estimatedTotalCost)}
                </span>
              </div>
              <div className="textAccent1Lighter">
                If your job finishes earlier than estimated, the unconsumed tokens remain in your escrow
              </div>
            </div>
          </Card>
        ) : null}
        <Button className={styles.button} color="accent1" size="lg" type="submit">
          Continue
        </Button>
      </form>
    </Card>
  );
};

export default SelectResources;
