import { CHAIN_ID } from '@/constants/chains';
import { ComputeEnvFees, ComputeEnvironment, ComputeResource } from '@/types/environments';
import { getAvailableAmount } from '@/utils/resources';
import { useMemo } from 'react';

export type EnvResources = {
  cpu?: ComputeResource;
  cpuAvailable: number;
  cpuFee?: number;
  disk?: ComputeResource;
  diskAvailable: number;
  diskFee?: number;
  gpus: ComputeResource[];
  // Available units per GPU resource id (min(max, total - inUse), clamped >= 0)
  gpusAvailable: Record<string, number>;
  gpuFees: Record<string, number>;
  maxJobDurationSeconds?: number;
  minJobDurationSeconds?: number;
  ram?: ComputeResource;
  ramAvailable: number;
  ramFee?: number;
  supportedTokens: string[];
};

type EnvResourcesArgs = {
  environment: ComputeEnvironment;
  freeCompute: boolean;
  tokenAddress: string;
};

type TokenFees = ComputeEnvFees | undefined;

/*
 * The steps below are plain functions so `readEnvResources` (a one-shot read, e.g. to price many
 * environments at once) and the hook compute the exact same thing. The hook keeps one memo per step
 * with the same dependencies it always had, so the identity of what it returns is unchanged.
 */

/** The env's fee schedule on the active chain, and the tokens it accepts. */
function chainFeesOf(envFees: ComputeEnvironment['fees']): { fees: ComputeEnvFees[]; supportedTokens: string[] } {
  try {
    const fees = envFees?.[CHAIN_ID];
    if (!fees) {
      return { fees: [], supportedTokens: [] };
    }
    const supportedTokens = fees.map((fee) => fee.feeToken);
    return { fees, supportedTokens };
  } catch (error) {
    console.error('Error processing fees:', error);
    return { fees: [], supportedTokens: [] };
  }
}

/** The env's CPU/RAM/disk/GPU resources, narrowed to the free tier's own limits when `freeCompute`. */
function resourcesOf({
  resources,
  freeResources,
  freeCompute,
}: {
  resources: ComputeEnvironment['resources'];
  freeResources: NonNullable<ComputeEnvironment['free']>['resources'];
  freeCompute: boolean;
}): { cpu?: ComputeResource; disk?: ComputeResource; gpus: ComputeResource[]; ram?: ComputeResource } {
  try {
    let cpu = resources?.find((res) => res.type === 'cpu' || res.id === 'cpu');
    let disk = resources?.find((res) => res.type === 'disk' || res.id === 'disk');
    let gpus = resources?.filter((res) => res.type === 'gpu' || res.id === 'gpu') ?? [];
    let ram = resources?.find((res) => res.type === 'ram' || res.id === 'ram');
    if (freeCompute) {
      // only keep resources that are available for free compute
      // and update their max / inUse values
      const free = freeResources ?? [];
      if (cpu) {
        const freeCpu = free.find((res) => res.id === cpu!.id);
        cpu = freeCpu ? { ...cpu, ...freeCpu } : undefined;
      }
      if (disk) {
        const freeDisk = free.find((res) => res.id === disk!.id);
        disk = freeDisk ? { ...disk, ...freeDisk } : undefined;
      }
      if (ram) {
        const freeRam = free.find((res) => res.id === ram!.id);
        ram = freeRam ? { ...ram, ...freeRam } : undefined;
      }
      if (gpus.length > 0) {
        const newGpus = [];
        for (const gpu of gpus) {
          const freeGpu = free.find((res) => res.id === gpu.id);
          if (freeGpu) {
            newGpus.push({ ...gpu, ...freeGpu });
          }
        }
        gpus = newGpus;
      }
    }
    return { cpu, disk, gpus, ram };
  } catch (error) {
    console.error('Error processing resources:', error);
    return { cpu: undefined, disk: undefined, gpus: [], ram: undefined };
  }
}

/** Per-unit CPU/RAM/disk fees in the selected token (all 0 on the free tier). */
function sharedFeesOf({
  cpuId,
  diskId,
  ramId,
  freeCompute,
  prices,
}: {
  cpuId?: string;
  diskId?: string;
  ramId?: string;
  freeCompute: boolean;
  prices: ComputeEnvFees['prices'] | undefined;
}): { cpuFee?: number; diskFee?: number; ramFee?: number } {
  try {
    if (freeCompute) {
      return { cpuFee: 0, diskFee: 0, ramFee: 0 };
    }
    const cpuFee = prices?.find((price) => price.id === cpuId)?.price;
    const diskFee = prices?.find((price) => price.id === diskId)?.price;
    const ramFee = prices?.find((price) => price.id === ramId)?.price;
    return { cpuFee, diskFee, ramFee };
  } catch (error) {
    console.error('Error processing fees:', error);
    return { cpuFee: undefined, diskFee: undefined, ramFee: undefined };
  }
}

/** Per-unit fee of every GPU resource id in the selected token (empty on the free tier). */
function gpuFeesOf({
  freeCompute,
  selectedTokenFees,
  gpus,
}: {
  freeCompute: boolean;
  selectedTokenFees: TokenFees;
  gpus: ComputeResource[];
}): Record<string, number> {
  try {
    if (freeCompute) {
      return {};
    }
    const fees: Record<string, number> = {};
    if (selectedTokenFees) {
      const gpuIds = gpus.map((gpu) => gpu.id);
      selectedTokenFees.prices
        .filter((fee) => gpuIds.includes(fee.id))
        .forEach((fee) => {
          fees[fee.id] = fee.price;
        });
    }
    return fees;
  } catch (error) {
    console.error('Error processing gpu fees:', error);
    return {};
  }
}

/** Job duration bounds: the free tier's own when `freeCompute` sets them, else the env's. */
function jobDurationsOf({
  freeCompute,
  freeMax,
  freeMin,
  max,
  min,
}: {
  freeCompute: boolean;
  freeMax?: number;
  freeMin?: number;
  max?: number;
  min?: number;
}): { maxJobDurationSeconds: number; minJobDurationSeconds: number } {
  const maxJobDurationSeconds = freeCompute && freeMax ? freeMax : (max ?? 0);
  const minJobDurationSeconds = freeCompute && freeMin ? freeMin : (min ?? 0);
  return { maxJobDurationSeconds, minJobDurationSeconds };
}

/** What one job can be granted right now, per resource (min(max, total - inUse)). */
function availabilityOf({
  cpu,
  disk,
  gpus,
  ram,
}: {
  cpu?: ComputeResource;
  disk?: ComputeResource;
  gpus: ComputeResource[];
  ram?: ComputeResource;
}): Pick<EnvResources, 'cpuAvailable' | 'diskAvailable' | 'gpusAvailable' | 'ramAvailable'> {
  const gpusAvailable: Record<string, number> = {};
  gpus.forEach((gpu) => {
    gpusAvailable[gpu.id] = getAvailableAmount(gpu);
  });
  return {
    cpuAvailable: getAvailableAmount(cpu),
    diskAvailable: getAvailableAmount(disk),
    gpusAvailable,
    ramAvailable: getAvailableAmount(ram),
  };
}

/** One-shot, non-React read of the same values {@link useEnvResources} returns. */
export function readEnvResources({ environment, freeCompute, tokenAddress }: EnvResourcesArgs): EnvResources {
  const { fees, supportedTokens } = chainFeesOf(environment.fees);
  const selectedTokenFees = fees.find((fee) => fee.feeToken === tokenAddress);
  const { cpu, disk, gpus, ram } = resourcesOf({
    resources: environment.resources,
    freeResources: environment.free?.resources,
    freeCompute,
  });
  return {
    cpu,
    disk,
    gpus,
    ram,
    ...sharedFeesOf({
      cpuId: cpu?.id,
      diskId: disk?.id,
      ramId: ram?.id,
      freeCompute,
      prices: selectedTokenFees?.prices,
    }),
    gpuFees: gpuFeesOf({ freeCompute, selectedTokenFees, gpus }),
    ...jobDurationsOf({
      freeCompute,
      freeMax: environment.free?.maxJobDuration,
      freeMin: environment.free?.minJobDuration,
      max: environment.maxJobDuration,
      min: environment.minJobDuration,
    }),
    ...availabilityOf({ cpu, disk, gpus, ram }),
    supportedTokens,
  };
}

const useEnvResources = ({ environment, freeCompute, tokenAddress }: EnvResourcesArgs): EnvResources => {
  const { fees, supportedTokens } = useMemo(() => chainFeesOf(environment.fees), [environment.fees]);

  const selectedTokenFees = useMemo(() => fees.find((fee) => fee.feeToken === tokenAddress), [fees, tokenAddress]);

  const { cpu, disk, gpus, ram } = useMemo(
    () => resourcesOf({ resources: environment.resources, freeResources: environment.free?.resources, freeCompute }),
    [environment.free?.resources, environment.resources, freeCompute]
  );

  const { cpuFee, diskFee, ramFee } = useMemo(
    () =>
      sharedFeesOf({
        cpuId: cpu?.id,
        diskId: disk?.id,
        ramId: ram?.id,
        freeCompute,
        prices: selectedTokenFees?.prices,
      }),
    [cpu?.id, disk?.id, freeCompute, ram?.id, selectedTokenFees?.prices]
  );

  const gpuFees = useMemo(
    () => gpuFeesOf({ freeCompute, selectedTokenFees, gpus }),
    [freeCompute, selectedTokenFees, gpus]
  );

  const { maxJobDurationSeconds, minJobDurationSeconds } = useMemo(
    () =>
      jobDurationsOf({
        freeCompute,
        freeMax: environment.free?.maxJobDuration,
        freeMin: environment.free?.minJobDuration,
        max: environment.maxJobDuration,
        min: environment.minJobDuration,
      }),
    [
      environment.free?.maxJobDuration,
      environment.free?.minJobDuration,
      environment.maxJobDuration,
      environment.minJobDuration,
      freeCompute,
    ]
  );

  const { cpuAvailable, diskAvailable, gpusAvailable, ramAvailable } = useMemo(
    () => availabilityOf({ cpu, disk, gpus, ram }),
    [cpu, disk, gpus, ram]
  );

  return {
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
    supportedTokens,
  };
};

export default useEnvResources;
