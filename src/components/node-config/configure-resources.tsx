import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import GpuLabel from '@/components/gpu-label/gpu-label';
import Input from '@/components/input/input';
import Slider from '@/components/slider/slider';
import Switch from '@/components/switch/switch';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { NodeConfig } from '@/types/node-config';
import CheckIcon from '@mui/icons-material/Check';
import DnsIcon from '@mui/icons-material/Dns';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import { Collapse } from '@mui/material';
import classNames from 'classnames';
import { useState } from 'react';
import commonStyles from './node-config.module.css';
import styles from './configure-resources.module.css';

type ConfigureResourcesProps = {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
};

type DockerEnv = NonNullable<NodeConfig['dockerComputeEnvironments']>[number];
type Resource = NonNullable<DockerEnv['resources']>[number];
type FreeCompute = NonNullable<DockerEnv['free']>;

const SUPPORTED_TOKENS = getSupportedTokens();
const TOKEN_SYMBOLS = Object.keys(SUPPORTED_TOKENS) as (keyof typeof SUPPORTED_TOKENS)[];
const CHAIN_ID_STR = String(CHAIN_ID);

const DEFAULT_FREE: FreeCompute = {
  access: { accessLists: [], addresses: [] },
  maxJobDuration: 3600,
  maxJobs: 1,
  minJobDuration: 0,
  resources: [],
};

// --- paid helpers ---

const isTokenEnabled = (env: DockerEnv, tokenAddress: string): boolean => {
  const chainFees = env.fees?.[CHAIN_ID_STR] ?? [];
  return chainFees.some((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase());
};

const toggleToken = (env: DockerEnv, tokenAddress: string, enabled: boolean): DockerEnv => {
  const fees = { ...(env.fees ?? {}) };
  const chainFees = [...(fees[CHAIN_ID_STR] ?? [])];
  if (enabled) {
    if (!chainFees.some((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase())) {
      chainFees.push({ feeToken: tokenAddress, prices: [] });
    }
  } else {
    const idx = chainFees.findIndex((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase());
    if (idx !== -1) chainFees.splice(idx, 1);
  }
  fees[CHAIN_ID_STR] = chainFees;
  return { ...env, fees };
};

const getTokenPrice = (env: DockerEnv, tokenAddress: string, resourceId: string): number | undefined => {
  const chainFees = env.fees?.[CHAIN_ID_STR] ?? [];
  const entry = chainFees.find((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase());
  return entry?.prices.find((p) => p.id === resourceId)?.price;
};

const setTokenPrice = (
  env: DockerEnv,
  tokenAddress: string,
  resourceId: string,
  price: number | undefined
): DockerEnv => {
  const fees = { ...(env.fees ?? {}) };
  const chainFees = [...(fees[CHAIN_ID_STR] ?? [])];
  const idx = chainFees.findIndex((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase());
  if (idx === -1) return env;
  const entry = chainFees[idx];
  const otherPrices = entry.prices.filter((p) => p.id !== resourceId);
  const newPrices = price === undefined ? otherPrices : [...otherPrices, { id: resourceId, price }];
  chainFees[idx] = { ...entry, prices: newPrices };
  fees[CHAIN_ID_STR] = chainFees;
  return { ...env, fees };
};

const setEnvResource = (env: DockerEnv, resourceId: string, patch: Partial<Resource>): DockerEnv => {
  const resources = (env.resources ?? []).map((r) => (r.id === resourceId ? { ...r, ...patch } : r));
  return { ...env, resources };
};

// --- free helpers ---

const toggleFreeResource = (env: DockerEnv, resourceId: string, enabled: boolean, defaultMax: number): DockerEnv => {
  const free = env.free!;
  if (enabled) {
    if (free.resources.some((r) => r.id === resourceId)) {
      return env;
    }
    return { ...env, free: { ...free, resources: [...free.resources, { id: resourceId, max: defaultMax }] } };
  }
  return { ...env, free: { ...free, resources: free.resources.filter((r) => r.id !== resourceId) } };
};

const setFreeResourceMax = (env: DockerEnv, resourceId: string, max: number): DockerEnv => {
  const free = env.free!;
  const resources = free.resources.map((r) => (r.id === resourceId ? { ...r, max } : r));
  return { ...env, free: { ...free, resources } };
};

// --- sub-components ---

type EnvEditorProps = {
  env: DockerEnv;
  onChange: (next: DockerEnv) => void;
};

const EnvEditor: React.FC<EnvEditorProps> = ({ env, onChange }) => {
  const resources = env.resources ?? [];
  const gpus = resources.filter((r) => r.type === 'gpu' || (!r.type && r.id.startsWith('gpu')));
  const cpu = resources.find((r) => r.type === 'cpu' || r.id === 'cpu');
  const ram = resources.find((r) => r.type === 'ram' || r.id === 'ram');
  const disk = resources.find((r) => r.type === 'disk' || r.id === 'disk');

  const freeEnabled = !!env.free;

  const handleGpuToggle = (gpuId: string, checked: boolean) => {
    onChange(setEnvResource(env, gpuId, { total: checked ? 1 : 0 }));
  };

  const handleTokenToggle = (tokenAddress: string, checked: boolean) => {
    onChange(toggleToken(env, tokenAddress, checked));
  };

  const handleTokenPriceChange = (tokenAddress: string, resourceId: string, value: string) => {
    onChange(setTokenPrice(env, tokenAddress, resourceId, value === '' ? undefined : Number(value)));
  };

  const handleRangeChange = (resourceId: string, value: number[]) => {
    const [min, max] = value;
    onChange(setEnvResource(env, resourceId, { min, max }));
  };

  const handleJobDurationChange = (key: 'minJobDuration' | 'maxJobDuration', value: string) => {
    onChange({ ...env, [key]: value === '' ? 0 : Number(value) });
  };

  const handleFreeToggle = (_: unknown, checked: boolean) => {
    onChange({ ...env, free: checked ? DEFAULT_FREE : undefined });
  };

  const handleFreeResourceToggle = (resourceId: string, checked: boolean, defaultMax: number) => {
    onChange(toggleFreeResource(env, resourceId, checked, defaultMax));
  };

  const handleFreeResourceMaxChange = (resourceId: string, value: string) => {
    onChange(setFreeResourceMax(env, resourceId, value === '' ? 0 : Number(value)));
  };

  const handleFreeDurationChange = (key: 'minJobDuration' | 'maxJobDuration', value: string) => {
    onChange({ ...env, free: { ...env.free!, [key]: value === '' ? 0 : Number(value) } });
  };

  const handleFreeMaxJobsChange = (value: string) => {
    onChange({ ...env, free: { ...env.free!, maxJobs: value === '' ? 0 : Number(value) } });
  };

  const enabledTokens = TOKEN_SYMBOLS.filter((sym) => isTokenEnabled(env, SUPPORTED_TOKENS[sym].address));

  const renderResourceRange = ({
    feeUnit,
    icon,
    label,
    resource,
    unit,
  }: {
    feeUnit?: string;
    icon: React.ReactNode;
    label: string;
    resource: Resource | undefined;
    unit: string;
  }) => {
    if (!resource) {
      return null;
    }
    const total = resource.total ?? 0;
    const min = resource.min ?? 0;
    const max = resource.max ?? total;
    const valueDisplay = unit ? `${min}-${max} ${unit}` : `${min}-${max}`;
    const totalDisplay = unit ? `Max ${total} ${unit}` : `Max ${total}`;
    return (
      <div className={styles.resourceRangeRow}>
        <Slider
          className={styles.resourceSlider}
          hint={valueDisplay}
          interval
          label={
            <div className="flexRow alignItemsCenter gapXs">
              {icon} {label}: {min} - {max}
            </div>
          }
          max={total}
          min={0}
          onChange={(_, v) => handleRangeChange(resource.id, v)}
          step={1}
          topRight={totalDisplay}
          value={[min, max]}
        />
        <div className="flexRow gapSm flexWrap">
          {enabledTokens.map((sym) => (
            <Input
              endAdornment={`${sym}/min`}
              key={sym}
              label={`Fee per ${feeUnit ?? unit}`}
              min={0}
              onChange={(e) => handleTokenPriceChange(SUPPORTED_TOKENS[sym].address, resource.id, e.target.value)}
              placeholder="0"
              size="sm"
              type="number"
              value={getTokenPrice(env, SUPPORTED_TOKENS[sym].address, resource.id) ?? ''}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderFreeResourceRange = ({
    icon,
    label,
    resource,
    unit,
  }: {
    icon: React.ReactNode;
    label: string;
    resource: Resource | undefined;
    unit: string;
  }) => {
    if (!resource || !env.free) {
      return null;
    }
    const freeRes = env.free.resources.find((r) => r.id === resource.id);
    const enabled = !!freeRes;
    const maxAllowed = resource.max ?? resource.total ?? 0;
    return (
      <Slider
        disabled={!enabled}
        label={
          <Switch
            checked={enabled}
            label={
              <div className="textBold flexRow alignItemsCenter gapXs">
                {icon} {label}: {freeRes?.max ?? 0} {unit}
              </div>
            }
            onChange={(_, checked) => handleFreeResourceToggle(resource.id, checked, maxAllowed)}
          />
        }
        max={maxAllowed}
        min={0}
        onChange={(_, v) => handleFreeResourceMaxChange(resource.id, String(v))}
        step={1}
        topRight={`Max ${freeRes?.max ?? 0} ${unit}`}
        value={freeRes?.max ?? 0}
      />
    );
  };

  return (
    <div className={styles.envEditorContent}>
      {/* Fee tokens */}
      <h4 className={commonStyles.subsectionTitle}>Accepted fee tokens</h4>
      <div className="flexRow gapMd flexWrap">
        {TOKEN_SYMBOLS.map((sym) => (
          <Checkbox
            checked={isTokenEnabled(env, SUPPORTED_TOKENS[sym].address)}
            key={sym}
            label={sym}
            onChange={(e) => handleTokenToggle(SUPPORTED_TOKENS[sym].address, e.target.checked)}
            type="multiple"
          />
        ))}
      </div>

      {/* Paid resources */}
      {gpus?.length > 0 ? (
        <>
          <h4 className={commonStyles.subsectionTitle}>GPUs</h4>
          {gpus.map((gpu) => (
            <div className={styles.gpuRow} key={gpu.id}>
              <Switch
                checked={(gpu.total ?? 0) > 0}
                label={<GpuLabel className="textBold" gpu={gpu.description ?? gpu.id} iconHeight={20} />}
                onChange={(_, checked) => handleGpuToggle(gpu.id, checked)}
              />
              <div className={classNames(styles.gpuPriceInput, 'flexRow gapSm flexWrap')}>
                {enabledTokens.map((sym) => (
                  <Input
                    endAdornment={`${sym}/min`}
                    key={sym}
                    min={0}
                    onChange={(e) => handleTokenPriceChange(SUPPORTED_TOKENS[sym].address, gpu.id, e.target.value)}
                    placeholder="0"
                    size="sm"
                    type="number"
                    value={getTokenPrice(env, SUPPORTED_TOKENS[sym].address, gpu.id) ?? ''}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      ) : null}
      <h4 className={commonStyles.subsectionTitle}>Other resources</h4>
      {renderResourceRange({
        feeUnit: 'core',
        icon: <MemoryIcon className="textAccent1" />,
        label: cpu?.description ? `CPU (${cpu.description})` : 'CPU',
        resource: cpu,
        unit: 'cores',
      })}
      {renderResourceRange({
        icon: <SdStorageIcon className="textAccent1" />,
        label: 'RAM',
        resource: ram,
        unit: 'GB',
      })}
      {renderResourceRange({
        icon: <DnsIcon className="textAccent1" />,
        label: 'Disk',
        resource: disk,
        unit: 'GB',
      })}

      <h4 className={commonStyles.subsectionTitle}>Job duration</h4>
      <div className={styles.jobDurationRow}>
        <Input
          endAdornment="seconds"
          label="Min. job duration"
          min={0}
          onChange={(e) => handleJobDurationChange('minJobDuration', e.target.value)}
          placeholder="0"
          size="sm"
          type="number"
          value={env.minJobDuration ?? ''}
        />
        <Input
          endAdornment="seconds"
          label="Max. job duration"
          min={0}
          onChange={(e) => handleJobDurationChange('maxJobDuration', e.target.value)}
          placeholder="0"
          size="sm"
          type="number"
          value={env.maxJobDuration ?? ''}
        />
      </div>

      {/* Test compute */}
      <Switch className="alignSelfStart" checked={freeEnabled} label="Test compute" onChange={handleFreeToggle} />
      <Collapse in={freeEnabled}>
        <div className={styles.freeSection}>
          {gpus?.length > 0 ? (
            <>
              <h4 className={commonStyles.subsectionTitle}>Test compute - GPUs</h4>
              {gpus.map((gpu) => {
                const freeGpu = env.free?.resources.find((r) => r.id === gpu.id);
                const enabled = !!freeGpu;
                const maxAllowed = gpu.max ?? gpu.total ?? 0;
                return (
                  <Switch
                    checked={enabled}
                    key={gpu.id}
                    label={<GpuLabel className="textBold" gpu={gpu.description ?? gpu.id} iconHeight={20} />}
                    onChange={(_, checked) => handleFreeResourceToggle(gpu.id, checked, maxAllowed)}
                  />
                );
              })}
            </>
          ) : null}

          <h4 className={commonStyles.subsectionTitle}>Test compute - other resources</h4>
          {renderFreeResourceRange({
            icon: <MemoryIcon className="textAccent1" />,
            label: cpu?.description ? `CPU (${cpu.description})` : 'CPU',
            resource: cpu,
            unit: 'cores',
          })}
          {renderFreeResourceRange({
            icon: <SdStorageIcon className="textAccent1" />,
            label: 'RAM',
            resource: ram,
            unit: 'GB',
          })}
          {renderFreeResourceRange({
            icon: <DnsIcon className="textAccent1" />,
            label: 'Disk',
            resource: disk,
            unit: 'GB',
          })}

          <h4 className={commonStyles.subsectionTitle}>Test compute - job duration</h4>
          <div className={styles.jobDurationRow}>
            <Input
              endAdornment="seconds"
              label="Min. test job duration"
              min={0}
              onChange={(e) => handleFreeDurationChange('minJobDuration', e.target.value)}
              placeholder="0"
              size="sm"
              type="number"
              value={env.free?.minJobDuration ?? ''}
            />
            <Input
              endAdornment="seconds"
              label="Max. test job duration"
              min={0}
              onChange={(e) => handleFreeDurationChange('maxJobDuration', e.target.value)}
              placeholder="0"
              size="sm"
              type="number"
              value={env.free?.maxJobDuration ?? ''}
            />
            <Input
              label="Max. test jobs"
              min={0}
              onChange={(e) => handleFreeMaxJobsChange(e.target.value)}
              placeholder="1"
              size="sm"
              type="number"
              value={env.free?.maxJobs ?? ''}
            />
          </div>
        </div>
      </Collapse>
    </div>
  );
};

const EnvPreview: React.FC<{ env: DockerEnv }> = ({ env }) => {
  const resources = env.resources ?? [];
  const gpus = resources.filter((r) => (r.type === 'gpu' || (!r.type && r.id.startsWith('gpu'))) && (r.total ?? 0) > 0);
  const cpu = resources.find((r) => r.type === 'cpu' || r.id === 'cpu');
  const ram = resources.find((r) => r.type === 'ram' || r.id === 'ram');
  const disk = resources.find((r) => r.type === 'disk' || r.id === 'disk');
  const free = env.free;

  return (
    <div className={styles.envPreview}>
      {gpus.map((gpu) => (
        <GpuLabel
          className={classNames('chip', 'chipGlass', styles.previewChip)}
          gpu={gpu.description ?? gpu.id}
          iconHeight={14}
          key={gpu.id}
        />
      ))}
      {cpu && (
        <span className={classNames('chip', 'chipGlass', styles.previewChip)}>
          <MemoryIcon className="textAccent1" sx={{ fontSize: 14 }} /> {cpu.min ?? 0}–{cpu.max ?? cpu.total} cores
        </span>
      )}
      {ram && (
        <span className={classNames('chip', 'chipGlass', styles.previewChip)}>
          <SdStorageIcon className="textAccent1" sx={{ fontSize: 14 }} /> {ram.min ?? 0}–{ram.max ?? ram.total} GB RAM
        </span>
      )}
      {disk && (
        <span className={classNames('chip', 'chipGlass', styles.previewChip)}>
          <DnsIcon className="textAccent1" sx={{ fontSize: 14 }} /> {disk.min ?? 0}–{disk.max ?? disk.total} GB disk
        </span>
      )}
      {free && (
        <span className={classNames('chip', 'chipGlass', styles.previewChip)}>
          <CheckIcon className="textAccent1" sx={{ fontSize: 14 }} /> Test compute
        </span>
      )}
    </div>
  );
};

const ConfigureResources: React.FC<ConfigureResourcesProps> = ({ config, setConfig }) => {
  const envs = config.dockerComputeEnvironments ?? [];
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);

  const toggleOpen = (index: number) => {
    setOpenIndexes((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const handleEnvChange = (index: number, next: DockerEnv) => {
    const updated = envs.map((e, i) => (i === index ? next : e));
    setConfig({ ...config, dockerComputeEnvironments: updated });
  };

  return (
    <div className={commonStyles.sectionContent}>
      {envs.length === 0 ? (
        <span className="textSecondary">No compute environments configured.</span>
      ) : (
        envs.map((env, index) => {
          const isOpen = openIndexes.includes(index);
          return (
            <Card
              direction="column"
              innerShadow="black"
              key={index}
              padding="md"
              radius="sm"
              spacing="sm"
              variant="glass-shaded"
            >
              <h3 className={commonStyles.collapsibleSectionTitle} onClick={() => toggleOpen(index)} tabIndex={0}>
                {envs.length > 1 ? `Environment ${index + 1}` : 'Compute environment'}
                <ExpandMoreIcon className={classNames(commonStyles.icon, { [commonStyles.iconOpen]: isOpen })} />
              </h3>
              <Collapse in={isOpen}>
                <EnvEditor env={env} onChange={(next) => handleEnvChange(index, next)} />
              </Collapse>
              <Collapse in={!isOpen}>
                <EnvPreview env={env} />
              </Collapse>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default ConfigureResources;
