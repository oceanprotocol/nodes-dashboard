import Button from '@/components/button/button';
import Card from '@/components/card/card';
import useEnvResources from '@/components/hooks/use-env-resources';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import VideoCardLabel from '@/components/video-card-label/video-card-label';
import { useRunJobContext } from '@/context/run-job-context';
import { ComputeEnvironment } from '@/types/environments';
import { formatNumber } from '@/utils/formatters';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import * as Yup from 'yup';
import styles from './select-resources.module.css';

type ResourcesFormValues = {
  cpuCores: number | '';
  diskSpace: number | '';
  gpus: string[];
  maxJobDuration: number | '';
  ram: number | '';
};

type SelectResourcesProps = {
  environment: ComputeEnvironment;
};

const SelectResources = ({ environment }: SelectResourcesProps) => {
  const router = useRouter();

  const { setEstimatedTotalCost } = useRunJobContext();

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee, tokenSymbol } = useEnvResources(environment);

  const maxAllowedCpuCores = cpu?.max ?? 0;
  const maxAllowedRam = ram?.max ?? 0;
  const maxAllowedDiskSpace = disk?.max ?? 0;
  const maxAllowedJobDurationHours = (environment.maxJobDuration ?? 0) / 60;

  const formik = useFormik<ResourcesFormValues>({
    initialValues: {
      cpuCores: '',
      diskSpace: '',
      gpus: [],
      maxJobDuration: '',
      ram: '',
    },
    onSubmit: (values) => {
      console.log('Form submitted with values:', values);
      // TODO only navigate to payment if not enough funds in escrow
      setEstimatedTotalCost(estimatedTotalCost);
      router.push('/run-job/payment');
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      cpuCores: Yup.number()
        .required('Required')
        .min(1, 'Limits exceeded')
        .max(maxAllowedCpuCores, 'Limits exceeded')
        .integer('Invalid format'),
      diskSpace: Yup.number()
        .required('Required')
        .min(0, 'Limits exceeded')
        .max(maxAllowedDiskSpace, 'Limits exceeded'),
      gpus: Yup.array().of(Yup.string()).min(1, 'Required'),
      maxJobDuration: Yup.number()
        .required('Required')
        .min(0, 'Limits exceeded')
        .max(maxAllowedJobDurationHours, 'Limits exceeded'),
      ram: Yup.number().required('Required').min(1, 'Limits exceeded').max(maxAllowedRam, 'Limits exceeded'),
    }),
  });

  const estimatedTotalCost = useMemo(() => {
    const timeInMinutes = Number(formik.values.maxJobDuration) * 60;
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
    formik.values.maxJobDuration,
    formik.values.ram,
    gpuFees,
    ramFee,
  ]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Select resources</h3>
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <Select
          errorText={formik.touched.gpus && formik.errors.gpus ? formik.errors.gpus : undefined}
          label="GPUs"
          multiple
          name="gpus"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          options={gpus.map((gpu) => ({ label: gpu.description ?? '', value: gpu.id }))}
          renderOption={(option) => (
            <VideoCardLabel card={`${option.label} (${gpuFees[option.value] ?? ''} ${tokenSymbol}/min)`} />
          )}
          renderSelectedValue={(option) => <VideoCardLabel card={option} />}
          value={formik.values.gpus}
        />
        <div className={styles.inputsGrid}>
          <Input
            endAdornment="cores"
            errorText={formik.touched.cpuCores && formik.errors.cpuCores ? formik.errors.cpuCores : undefined}
            hint={`${cpuFee ?? 0} ${tokenSymbol}/core`}
            label="CPU"
            name="cpuCores"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            topRight={`${1}-${maxAllowedCpuCores}`}
            type="number"
            value={formik.values.cpuCores}
          />
          <Input
            endAdornment="GB"
            errorText={formik.touched.ram && formik.errors.ram ? formik.errors.ram : undefined}
            hint={`${ramFee ?? 0} ${tokenSymbol}/GB`}
            label="RAM"
            name="ram"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            topRight={`${1}-${maxAllowedRam}`}
            type="number"
            value={formik.values.ram}
          />
          <Input
            endAdornment="GB"
            errorText={formik.touched.diskSpace && formik.errors.diskSpace ? formik.errors.diskSpace : undefined}
            hint={`${diskFee ?? 0} ${tokenSymbol}/GB`}
            label="Disk space"
            name="diskSpace"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            topRight={`${0}-${maxAllowedDiskSpace}`}
            type="number"
            value={formik.values.diskSpace}
          />
          <Input
            endAdornment="hours"
            errorText={
              formik.touched.maxJobDuration && formik.errors.maxJobDuration ? formik.errors.maxJobDuration : undefined
            }
            label="Max job duration"
            name="maxJobDuration"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            topRight={`${0}-${maxAllowedJobDurationHours}`}
            type="number"
            value={formik.values.maxJobDuration}
          />
        </div>
        {formik.isValid ? (
          <Card className={styles.cost} variant="accent1-outline" radius="md">
            <h3>Estimated total cost</h3>
            <div className={styles.values}>
              <div>
                <span className={styles.token}>{tokenSymbol}</span>
                &nbsp;
                {/* // TODO */}
                <span className={styles.amount}>{formatNumber(estimatedTotalCost)}</span>
              </div>
              <div className={styles.reimbursment}>If the job is shorter, you will get your tokens back</div>
            </div>
          </Card>
        ) : null}
        <Button className={styles.button} color="accent2" size="lg" type="submit">
          Continue
        </Button>
      </form>
    </Card>
  );
};

export default SelectResources;
