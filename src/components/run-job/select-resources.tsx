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
import { formatNumber } from '@/utils/formatters';
import { useAuthModal } from '@account-kit/react';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
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
  maxJobDurationHours: number;
  ram: number;
};

const SelectResources = ({ environment, freeCompute, token }: SelectResourcesProps) => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();
  const router = useRouter();

  const { account } = useOceanAccount();

  const { nodeInfo, setEstimatedTotalCost, setMinLockSeconds, setSelectedResources } = useRunJobContext();

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
  const minAllowedJobDurationHours = environment.minJobDuration ?? 0;
  const minAllowedRam = ram?.min ?? 0;

  const maxAllowedCpuCores = cpu?.max ?? minAllowedCpuCores;
  const maxAllowedDiskSpace = disk?.max ?? minAllowedDiskSpace;
  const maxAllowedJobDurationHours = (environment.maxJobDuration ?? minAllowedJobDurationHours) / 60 / 60;
  const maxAllowedRam = ram?.max ?? minAllowedRam;

  const formik = useFormik<ResourcesFormValues>({
    initialValues: {
      cpuCores: minAllowedCpuCores,
      diskSpace: minAllowedDiskSpace,
      gpus: [],
      maxJobDurationHours: minAllowedJobDurationHours,
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
        maxJobDurationHours: values.maxJobDurationHours,
        ram: values.ram,
        ramId: ram?.id ?? 'ram',
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
      maxJobDurationHours: Yup.number()
        .required('Required')
        .min(minAllowedJobDurationHours, 'Limits exceeded')
        .max(maxAllowedJobDurationHours, 'Limits exceeded'),
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
      const maxJobDurationSec = formik.values.maxJobDurationHours * 60 * 60;
      const { cost, minLockSeconds } = await initializeCompute(
        environment,
        token.address,
        maxJobDurationSec < 1 ? 1 : Math.ceil(maxJobDurationSec),
        nodeInfo.id,
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
    formik.values.maxJobDurationHours,
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

  const setMaxJobDurationHours = () => {
    formik.setFieldValue('maxJobDurationHours', maxAllowedJobDurationHours);
  };

  const handleDiskSpaceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Number(e.target.value);
    formik.setFieldValue('diskSpace', e.target.value === '' ? 0 : Math.max(0, num));
  };

  const handleMaxJobDurationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Number(e.target.value);
    formik.setFieldValue('maxJobDurationHours', e.target.value === '' ? 0 : Math.max(0, num));
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
              <Button color="accent2" onClick={setMaxJobDurationHours} size="sm" type="button" variant="filled">
                Set max
              </Button>
            }
            errorText={
              formik.touched.maxJobDurationHours && formik.errors.maxJobDurationHours
                ? formik.errors.maxJobDurationHours
                : undefined
            }
            label="Max job duration"
            max={maxAllowedJobDurationHours}
            min={0}
            name="maxJobDurationHours"
            onBlur={formik.handleBlur}
            onChange={handleMaxJobDurationChange}
            startAdornment="hours"
            topRight={`${minAllowedJobDurationHours}-${maxAllowedJobDurationHours}`}
            type="number"
            value={formik.values.maxJobDurationHours}
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
                If your job finishes early, the unconsumed tokens remain in escrow
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
