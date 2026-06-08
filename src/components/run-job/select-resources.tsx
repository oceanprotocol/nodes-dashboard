import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import useEnvResources from '@/components/hooks/use-env-resources';
import DurationInput from '@/components/input/duration-input';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Slider from '@/components/slider/slider';
import config from '@/config';
import { SelectedToken, useRunJobContext } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import { formatDuration, formatTokenAmount, roundTokenAmount } from '@/utils/formatters';
import { usePrivy } from '@privy-io/react-auth';
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
  maxJobDurationSeconds: number;
  ram: number;
};

const SelectResources = ({ environment, freeCompute, token }: SelectResourcesProps) => {
  const { login } = usePrivy();
  const router = useRouter();

  const { isReady: p2pReady } = useP2P();

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

  const costEstimateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ESTIMATE_COST_DEBOUNCE_MS = 800;

  const isCostEstimated = !isLoadingCost && (estimatedTotalCost || estimatedTotalCost === 0) && !initComputeError;

  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, maxJobDurationSeconds, minJobDurationSeconds, ram, ramFee } =
    useEnvResources({
      environment,
      freeCompute,
      tokenAddress: token?.address ?? '',
    });

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
      maxJobDurationSeconds: selectedMaxJobDurationSeconds ?? minAllowedJobDurationSeconds,
      ram: selectedRam ?? minAllowedRam,
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
        cpuCores: values.cpuCores,
        cpuId: cpu?.id ?? 'cpu',
        diskSpace: Number(values.diskSpace) || 0,
        diskId: disk?.id ?? 'disk',
        gpus: gpus
          .filter((gpu) => values.gpus.includes(gpu.id))
          .map((gpu) => ({ id: gpu.id, description: gpu.description })),
        maxJobDurationSeconds: values.maxJobDurationSeconds,
        ram: values.ram,
        ramId: ram?.id ?? 'ram',
      });
      posthog.capture('environment_configured', {
        cpuCores: values.cpuCores,
        ram: values.ram,
        diskSpace: Number(values.diskSpace) || 0,
        gpus: values.gpus,
        maxJobDurationSeconds: values.maxJobDurationSeconds,
        estimatedTotalCost,
        freeCompute,
      });
      const query = {
        ...router.query,
        cpu: values.cpuCores,
        ram: values.ram,
        disk: values.diskSpace,
        ...(values.gpus.length > 0 && { gpus: values.gpus }),
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
      maxJobDurationSeconds: Yup.number()
        .required('Required')
        .min(minAllowedJobDurationSeconds, 'Limits exceeded')
        .max(maxAllowedJobDurationSeconds, 'Limits exceeded'),
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
    const maxJobDurationSec = formik.values.maxJobDurationSeconds;
    await fetchEstimatedCost({
      environment,
      freeCompute,
      maxJobDurationSeconds: maxJobDurationSec < 1 ? 1 : Math.ceil(maxJobDurationSec),
      multiaddrsOrPeerId: multiaddrsOrPeerId!,
      onError: (error) => setInitComputeError(error),
      resources,
      tokenAddress: token?.address,
    });
    setIsLoadingCost(false);
  }, [
    fetchEstimatedCost,
    environment,
    freeCompute,
    formik.values.maxJobDurationSeconds,
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
  }, [estimateCost]);

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
    formik.setFieldValue('maxJobDurationSeconds', maxAllowedJobDurationSeconds);
  };

  const handleDiskSpaceChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value === '') {
      formik.setFieldValue('diskSpace', '');
      return;
    }
    const num = Number(e.target.value);
    formik.setFieldValue('diskSpace', Math.max(0, num));
  };

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
            topRight={`${minAllowedCpuCores} - ${maxAllowedCpuCores}`}
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
            topRight={`${minAllowedRam} - ${maxAllowedRam}`}
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
            topRight={`${minAllowedDiskSpace} - ${maxAllowedDiskSpace}`}
            type="number"
            value={formik.values.diskSpace}
          />
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
        </div>
        {freeCompute ? null : (
          <TransitionGroup>
            {initComputeError ? <Collapse>{renderConnectionErrorCard()}</Collapse> : null}
            {!initComputeError && formik.isValid ? <Collapse>{renderCostCard()}</Collapse> : null}
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
          <Button disabled={!isCostEstimated} color="accent1" size="lg" type="submit">
            Continue
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default SelectResources;
