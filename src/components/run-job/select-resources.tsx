import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Slider from '@/components/slider/slider';
import { useRunJobContext } from '@/context/run-job-context';
import { ComputeEnvironment } from '@/types/environments';
import { formatNumber } from '@/utils/formatters';
import { useAuthModal, useSignerStatus } from '@account-kit/react';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import * as Yup from 'yup';
import styles from './select-resources.module.css';

type ResourcesFormValues = {
  cpuCores: number;
  diskSpace: number;
  gpus: string[];
  maxJobDurationHours: number;
  ram: number;
};

type SelectResourcesProps = {
  environment: ComputeEnvironment;
};

const SelectResources = ({ environment }: SelectResourcesProps) => {
  const { openAuthModal } = useAuthModal();
  const router = useRouter();
  const { isAuthenticating, isDisconnected } = useSignerStatus();

  const { setEstimatedTotalCost, setSelectedResources } = useRunJobContext();

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee, tokenSymbol } = useEnvResources(environment);

  // TODO implement min job duration

  const minAllowedCpuCores = cpu?.min ?? 1;
  const minAllowedDiskSpace = disk?.min ?? 0;
  const minAllowedJobDurationHours = 0;
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
      if (isDisconnected) {
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
      if (estimatedTotalCost > 0) {
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
      gpus: Yup.array().of(Yup.string()).min(1, 'Required'),
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

  const estimatedTotalCost = useMemo(() => {
    const timeInMinutes = Number(formik.values.maxJobDurationHours) * 60;
    const cpuCost = Number(formik.values.cpuCores) * (cpuFee ?? 0) * timeInMinutes;
    const ramCost = Number(formik.values.ram) * (ramFee ?? 0) * timeInMinutes;
    const diskCost = Number(formik.values.diskSpace) * (diskFee ?? 0) * timeInMinutes;
    const gpuCost = formik.values.gpus.reduce((total, gpuId) => {
      const fee = gpuFees[gpuId] ?? 0;
      return total + fee * timeInMinutes;
    }, 0);
    return cpuCost + ramCost + diskCost + gpuCost;
  }, [
    cpuFee,
    diskFee,
    formik.values.cpuCores,
    formik.values.diskSpace,
    formik.values.gpus,
    formik.values.maxJobDurationHours,
    formik.values.ram,
    gpuFees,
    ramFee,
  ]);

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

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Select resources</h3>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <Select
          endAdornment={
            <Button color="accent1" onClick={selectAllGpus} size="sm" type="button" variant="outlined">
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
          renderOption={(option) => (
            <GpuLabel gpu={`${option.label} (${gpuFees[option.value] ?? ''} ${tokenSymbol}/min)`} />
          )}
          renderSelectedValue={(option) => <GpuLabel gpu={option} />}
          value={formik.values.gpus}
        />
        <div className={styles.inputsGrid}>
          <Slider
            errorText={formik.touched.cpuCores && formik.errors.cpuCores ? formik.errors.cpuCores : undefined}
            hint={`${cpuFee ?? 0} ${tokenSymbol}/core`}
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
            hint={`${ramFee ?? 0} ${tokenSymbol}/GB`}
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
              <Button color="accent1" onClick={setMaxDiskSpace} size="sm" type="button" variant="outlined">
                Set max
              </Button>
            }
            errorText={formik.touched.diskSpace && formik.errors.diskSpace ? formik.errors.diskSpace : undefined}
            hint={`${diskFee ?? 0} ${tokenSymbol}/GB`}
            label="Disk space"
            name="diskSpace"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            startAdornment="GB"
            topRight={`${minAllowedDiskSpace}-${maxAllowedDiskSpace}`}
            type="number"
            value={formik.values.diskSpace}
          />
          <Input
            endAdornment={
              <Button color="accent1" onClick={setMaxJobDurationHours} size="sm" type="button" variant="outlined">
                Set max
              </Button>
            }
            errorText={
              formik.touched.maxJobDurationHours && formik.errors.maxJobDurationHours
                ? formik.errors.maxJobDurationHours
                : undefined
            }
            label="Max job duration"
            name="maxJobDurationHours"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            startAdornment="hours"
            topRight={`${minAllowedJobDurationHours}-${maxAllowedJobDurationHours}`}
            type="number"
            value={formik.values.maxJobDurationHours}
          />
        </div>
        {formik.isValid ? (
          <Card className={styles.cost} variant="accent1-outline" radius="md">
            <h3>Estimated total cost</h3>
            <div className={styles.values}>
              <div>
                <span className={styles.token}>{tokenSymbol}</span>
                &nbsp;
                <span className={styles.amount}>{formatNumber(estimatedTotalCost)}</span>
              </div>
              <div className={styles.reimbursment}>
                If your job finishes early, the unconsumed tokens remain in escrow
              </div>
            </div>
          </Card>
        ) : null}
        <Button className={styles.button} color="accent2" loading={isAuthenticating} size="lg" type="submit">
          Continue
        </Button>
      </form>
    </Card>
  );
};

export default SelectResources;
