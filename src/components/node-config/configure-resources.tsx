import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import GpuLabel from '@/components/gpu-label/gpu-label';
import DurationInput from '@/components/input/duration-input';
import Input from '@/components/input/input';
import Slider from '@/components/slider/slider';
import Switch from '@/components/switch/switch';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { NodeConfig } from '@/types/node-config';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import CheckIcon from '@mui/icons-material/Check';
import DnsIcon from '@mui/icons-material/Dns';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MemoryIcon from '@mui/icons-material/Memory';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import { Collapse } from '@mui/material';
import classNames from 'classnames';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import AccessEditor from './access-editor';
import styles from './configure-resources.module.css';
import commonStyles from './node-config.module.css';

type ConfigureResourcesProps = {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
};

type Environment = NonNullable<NodeConfig['dockerComputeEnvironments']>[number];
type Resource = NonNullable<Environment['resources']>[number];
type FreeCompute = NonNullable<Environment['free']>;

const BENCH_ENV_DESCRIPTION = 'Auto-generated benchmark environment';

const SUPPORTED_TOKENS = getSupportedTokens();
const TOKEN_SYMBOLS = Object.keys(SUPPORTED_TOKENS) as (keyof typeof SUPPORTED_TOKENS)[];
const CHAIN_ID_STR = String(CHAIN_ID);

const DEFAULT_NEW_ENV: Environment = {
  access: { accessLists: [], addresses: [] },
  fees: {},
  resources: [],
  storageExpiry: 0,
};

const DEFAULT_FREE: FreeCompute = {
  access: { accessLists: [], addresses: [] },
  maxJobDuration: 3600,
  maxJobs: 1,
  minJobDuration: 0,
  resources: [],
};

// --- paid helpers ---

const isTokenEnabled = (env: Environment, tokenAddress: string): boolean => {
  const chainFees = env.fees?.[CHAIN_ID_STR] ?? [];
  return chainFees.some((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase());
};

const toggleToken = (env: Environment, tokenAddress: string, enabled: boolean): Environment => {
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

const getTokenPrice = (env: Environment, tokenAddress: string, resourceId: string): number | undefined => {
  const chainFees = env.fees?.[CHAIN_ID_STR] ?? [];
  const entry = chainFees.find((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase());
  return entry?.prices.find((p) => p.id === resourceId)?.price;
};

const setTokenPrice = (
  env: Environment,
  tokenAddress: string,
  resourceId: string,
  price: number | undefined
): Environment => {
  const fees = { ...(env.fees ?? {}) };
  const chainFees = [...(fees[CHAIN_ID_STR] ?? [])];
  const idx = chainFees.findIndex((f) => f.feeToken.toLowerCase() === tokenAddress.toLowerCase());
  if (idx === -1) {
    return env;
  }
  const entry = chainFees[idx];
  const otherPrices = entry.prices.filter((p) => p.id !== resourceId);
  const newPrices = price === undefined ? otherPrices : [...otherPrices, { id: resourceId, price }];
  chainFees[idx] = { ...entry, prices: newPrices };
  fees[CHAIN_ID_STR] = chainFees;
  return { ...env, fees };
};

const setEnvResource = (env: Environment, resourceId: string, patch: Partial<Resource>): Environment => {
  const resources = (env.resources ?? []).map((r) => (r.id === resourceId ? { ...r, ...patch } : r));
  return { ...env, resources };
};

// --- free helpers ---

const toggleFreeResource = (
  env: Environment,
  resourceId: string,
  enabled: boolean,
  defaultMax: number
): Environment => {
  const free = env.free!;
  if (enabled) {
    if (free.resources.some((r) => r.id === resourceId)) {
      return env;
    }
    return { ...env, free: { ...free, resources: [...free.resources, { id: resourceId, max: defaultMax }] } };
  }
  return { ...env, free: { ...free, resources: free.resources.filter((r) => r.id !== resourceId) } };
};

const setFreeResourceMax = (env: Environment, resourceId: string, max: number): Environment => {
  const free = env.free!;
  const resources = free.resources.map((r) => (r.id === resourceId ? { ...r, max } : r));
  return { ...env, free: { ...free, resources } };
};

// --- access helpers ---

type AccessConfig = NonNullable<Environment['access']>;

const getAccessListContracts = (access: AccessConfig): string[] =>
  access.accessLists.flatMap((entry) => entry[CHAIN_ID_STR] ?? []);

const setAccessListContracts = (access: AccessConfig, contracts: string[]): AccessConfig => ({
  ...access,
  accessLists: [
    ...access.accessLists.filter((entry) => !entry[CHAIN_ID_STR]),
    ...contracts.map((addr) => ({ [CHAIN_ID_STR]: [addr] })),
  ],
});

type EnvEditorProps = {
  allResources: Record<string, Resource>;
  disabled?: boolean;
  env: Environment;
  onChange: (next: Environment) => void;
};

const EnvEditor: React.FC<EnvEditorProps> = ({ allResources, disabled, env, onChange }) => {
  const allResourcesList = Object.values(allResources);
  const gpus = allResourcesList.filter((r) => r.type === 'gpu' || (!r.type && r.id.startsWith('gpu')));
  const cpu = allResourcesList.find((r) => r.type === 'cpu' || r.id === 'cpu');
  const ram = allResourcesList.find((r) => r.type === 'ram' || r.id === 'ram');
  const disk = allResourcesList.find((r) => r.type === 'disk' || r.id === 'disk');

  const freeEnabled = !!env.free;

  const handleGpuToggle = (gpu: Resource, checked: boolean) => {
    const exists = (env.resources ?? []).some((r) => r.id === gpu.id);
    if (checked) {
      onChange(
        exists
          ? setEnvResource(env, gpu.id, { total: 1 })
          : { ...env, resources: [...(env.resources ?? []), { ...gpu, total: 1 }] }
      );
    } else {
      onChange({ ...env, resources: (env.resources ?? []).filter((r) => r.id !== gpu.id) });
    }
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

  const handleJobDurationChange = (key: 'minJobDuration' | 'maxJobDuration', seconds: number) => {
    onChange({ ...env, [key]: seconds });
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

  const handleFreeDurationChange = (key: 'minJobDuration' | 'maxJobDuration', seconds: number) => {
    onChange({ ...env, free: { ...env.free!, [key]: seconds } });
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
    const envResource = (env.resources ?? []).find((r) => r.id === resource.id);
    const included = !!envResource;
    const total = resource.total ?? 0;
    const min = envResource?.min ?? 0;
    const max = envResource?.max ?? total;
    const valueDisplay = unit ? `${min}-${max} ${unit}` : `${min}-${max}`;
    const totalDisplay = unit ? `Max ${total} ${unit}` : `Max ${total}`;

    const handleToggle = (_: unknown, checked: boolean) => {
      if (checked) {
        onChange({ ...env, resources: [...(env.resources ?? []), { ...resource }] });
      } else {
        onChange({ ...env, resources: (env.resources ?? []).filter((r) => r.id !== resource.id) });
      }
    };

    return (
      <div className={styles.resourcePaidRow}>
        <Slider
          className={styles.resourceSlider}
          disabled={disabled || !included}
          hint={valueDisplay}
          interval
          label={
            <Switch
              checked={included}
              disabled={disabled}
              label={
                <div className="flexRow alignItemsCenter gapXs">
                  {icon} {label}: {min} - {max}
                </div>
              }
              onChange={handleToggle}
            />
          }
          max={total}
          min={0}
          onChange={(_, v) => handleRangeChange(resource.id, v)}
          step={1}
          topRight={totalDisplay}
          value={[min, max]}
        />
        {included ? (
          <div className={styles.resourcePriceInputs}>
            {enabledTokens.map((sym) => (
              <Input
                disabled={disabled}
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
        ) : null}
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
    const maxAllowed = resource.max ?? resource.total ?? 0;
    return (
      <Slider
        disabled={disabled || !freeRes}
        label={
          <Switch
            checked={!!freeRes}
            disabled={disabled}
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
      <Input
        disabled={disabled}
        label="Description"
        name="description"
        onChange={(e) => onChange({ ...env, description: e.target.value || undefined })}
        size="sm"
        type="text"
        value={env.description ?? ''}
      />
      {/* Paid access */}
      <Card innerShadow="black" padding="sm" radius="sm" variant="glass">
        <AccessEditor
          accessListAddresses={getAccessListContracts(env.access ?? { accessLists: [], addresses: [] })}
          disabled={disabled}
          onAccessListAddressesChange={(contracts) =>
            onChange({
              ...env,
              access: setAccessListContracts(env.access ?? { accessLists: [], addresses: [] }, contracts),
            })
          }
          onWalletAddressesChange={(addresses) =>
            onChange({ ...env, access: { ...(env.access ?? { accessLists: [], addresses: [] }), addresses } })
          }
          title="Paid compute access"
          walletAddresses={env.access?.addresses ?? []}
        />
      </Card>
      {/* Fee tokens */}
      <h4 className={commonStyles.subsectionTitle}>Accepted fee tokens</h4>
      <div className="flexRow gapMd flexWrap">
        {TOKEN_SYMBOLS.map((sym) => (
          <Checkbox
            checked={isTokenEnabled(env, SUPPORTED_TOKENS[sym].address)}
            disabled={disabled}
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
          {gpus.map((gpu) => {
            const envGpu = (env.resources ?? []).find((r) => r.id === gpu.id);
            return (
              <div className={styles.resourcePaidRow} key={gpu.id}>
                <Switch
                  checked={(envGpu?.total ?? 0) > 0}
                  className="justifySelfStart"
                  disabled={disabled}
                  label={<GpuLabel className="textBold" gpu={gpu.description ?? gpu.id} iconHeight={20} />}
                  onChange={(_, checked) => handleGpuToggle(gpu, checked)}
                />
                <div className={styles.resourcePriceInputs}>
                  {enabledTokens.map((sym) => (
                    <Input
                      disabled={disabled}
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
            );
          })}
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
        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit="seconds"
          disabled={disabled}
          label="Min. job duration"
          onChange={(seconds) => handleJobDurationChange('minJobDuration', seconds)}
          size="sm"
          value={env.minJobDuration ?? 0}
        />
        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit="seconds"
          disabled={disabled}
          label="Max. job duration"
          onChange={(seconds) => handleJobDurationChange('maxJobDuration', seconds)}
          size="sm"
          value={env.maxJobDuration ?? 0}
        />
        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit="hours"
          disabled={disabled}
          label="Storage expiry"
          hint="How long job output is retained"
          onChange={(seconds) => onChange({ ...env, storageExpiry: seconds })}
          size="sm"
          value={env.storageExpiry ?? 604800}
        />
      </div>
      {/* Enable network */}
      <Switch
        className="alignSelfStart"
        checked={!!env.enableNetwork}
        disabled={disabled}
        label="Enable internet access for jobs"
        onChange={(_, checked) => onChange({ ...env, enableNetwork: checked })}
      />
      {/* Test compute */}
      <Switch
        className="alignSelfStart"
        checked={freeEnabled}
        disabled={disabled}
        label="Test compute"
        onChange={handleFreeToggle}
      />
      <Collapse in={freeEnabled}>
        <Card innerShadow="black" padding="sm" radius="sm" variant="glass">
          <AccessEditor
            accessListAddresses={getAccessListContracts(env.free?.access ?? { accessLists: [], addresses: [] })}
            disabled={disabled}
            onAccessListAddressesChange={(contracts) =>
              onChange({
                ...env,
                free: {
                  ...env.free!,
                  access: setAccessListContracts(env.free?.access ?? { accessLists: [], addresses: [] }, contracts),
                },
              })
            }
            onWalletAddressesChange={(addresses) =>
              onChange({
                ...env,
                free: {
                  ...env.free!,
                  access: { ...(env.free?.access ?? { accessLists: [], addresses: [] }), addresses },
                },
              })
            }
            title="Test compute access"
            walletAddresses={env.free?.access?.addresses ?? []}
          />
        </Card>
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
                    className="alignSelfStart"
                    disabled={disabled}
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
            <DurationInput
              availableUnits={DURATION_UNIT_OPTIONS}
              defaultUnit="seconds"
              disabled={disabled}
              label="Min. test job duration"
              onChange={(seconds) => handleFreeDurationChange('minJobDuration', seconds)}
              size="sm"
              value={env.free?.minJobDuration ?? 0}
            />
            <DurationInput
              availableUnits={DURATION_UNIT_OPTIONS}
              defaultUnit="seconds"
              disabled={disabled}
              label="Max. test job duration"
              onChange={(seconds) => handleFreeDurationChange('maxJobDuration', seconds)}
              size="sm"
              value={env.free?.maxJobDuration ?? 0}
            />
            <Input
              disabled={disabled}
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

const EnvPreview: React.FC<{ env: Environment }> = ({ env }) => {
  const resources = env.resources ?? [];
  const gpus = resources.filter((r) => (r.type === 'gpu' || (!r.type && r.id.startsWith('gpu'))) && (r.total ?? 0) > 0);
  const cpu = resources.find((r) => r.type === 'cpu' || r.id === 'cpu');
  const ram = resources.find((r) => r.type === 'ram' || r.id === 'ram');
  const disk = resources.find((r) => r.type === 'disk' || r.id === 'disk');
  const free = env.free;

  return (
    <div className={styles.envPreview}>
      {env.description ? <div className="textSecondary">{env.description}</div> : null}
      <div className={styles.envPreviewResources}>
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
    </div>
  );
};

const ConfigureResources: React.FC<ConfigureResourcesProps> = ({ config, setConfig }) => {
  const envs = config.dockerComputeEnvironments ?? [];

  /**
   * Computed mapping of all resources across environments.
   * Different environments may specify different subsets of resources with different totals.
   * This is only computed once on initial render.
   */
  const allResourcesRef = useRef<Record<string, Resource> | null>(null);
  if (allResourcesRef.current === null && envs.length > 0) {
    const computed: Record<string, Resource> = {};
    for (const env of envs) {
      for (const resource of env.resources ?? []) {
        const existing = computed[resource.id];
        if (existing) {
          computed[resource.id] = {
            ...existing,
            ...resource,
            total:
              (existing.total || existing.total === 0) && (resource.total || resource.total === 0)
                ? Math.max(existing.total, resource.total)
                : (existing.total ?? resource.total),
            min:
              (existing.min || existing.min === 0) && (resource.min || resource.min === 0)
                ? Math.min(existing.min, resource.min)
                : (existing.min ?? resource.min),
            max:
              (existing.max || existing.max === 0) && (resource.max || resource.max === 0)
                ? Math.max(existing.max, resource.max)
                : (existing.max ?? resource.max),
          };
        } else {
          computed[resource.id] = resource;
        }
      }
    }
    allResourcesRef.current = computed;
  }

  const [openIndexes, setOpenIndexes] = useState<number[]>([]);

  const toggleOpen = (index: number) => {
    setOpenIndexes((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const handleEnvChange = (index: number, next: Environment) => {
    const updated = envs.map((e, i) => (i === index ? next : e));
    setConfig({ ...config, dockerComputeEnvironments: updated });
  };

  const handleEnvDelete = (index: number) => {
    setConfig({ ...config, dockerComputeEnvironments: envs.filter((_, i) => i !== index) });
    setOpenIndexes((prev) => prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
    toast.info(`Deleted environment from position ${index + 1}`);
  };

  const handleEnvAdd = () => {
    const newIndex = envs.length;
    setConfig({ ...config, dockerComputeEnvironments: [...envs, { ...DEFAULT_NEW_ENV }] });
    setOpenIndexes((prev) => [...prev, newIndex]);
    toast.info(`Added environment on position ${newIndex + 1}`);
  };

  return (
    <div className={commonStyles.sectionContent}>
      {envs.length === 0 ? (
        <span className="textSecondary">No compute environments configured.</span>
      ) : (
        envs.map((env, index) => {
          const isOpen = openIndexes.includes(index);
          const isBench = env.description === BENCH_ENV_DESCRIPTION;
          return (
            <Card direction="column" innerShadow="black" key={index} padding="md" radius="sm" variant="glass-shaded">
              <div className={commonStyles.envCardHeader}>
                <div className={commonStyles.collapsibleSectionTitle} onClick={() => toggleOpen(index)} tabIndex={0}>
                  <h3>Environment {index + 1}</h3>
                  <ExpandMoreIcon className={classNames(commonStyles.icon, { [commonStyles.iconOpen]: isOpen })} />
                </div>
                {isBench ? (
                  <div className="chip chipPrimaryOutlined">Read-only</div>
                ) : (
                  <Button color="error" onClick={() => handleEnvDelete(index)} size="sm" type="button" variant="filled">
                    Delete
                  </Button>
                )}
              </div>
              <Collapse in={isOpen}>
                <EnvEditor
                  allResources={allResourcesRef.current ?? {}}
                  disabled={isBench}
                  env={env}
                  onChange={(next) => handleEnvChange(index, next)}
                />
              </Collapse>
              <Collapse in={!isOpen}>
                <EnvPreview env={env} />
              </Collapse>
            </Card>
          );
        })
      )}
      <Button
        className="alignSelfCenter"
        color="accent1"
        onClick={handleEnvAdd}
        size="md"
        type="button"
        variant="filled"
      >
        Add new environment
      </Button>
    </div>
  );
};

export default ConfigureResources;
