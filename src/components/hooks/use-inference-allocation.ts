import useEnvResources from '@/components/hooks/use-env-resources';
import { ComputeEnvironment } from '@/types/environments';
import { ComputeResource } from '@oceanprotocol/lib';
import { useMemo } from 'react';

export type MergedGpu = {
  /** Key used to address this type in the selection map (description, or a synthetic fallback). */
  key: string;
  description?: string;
  max: number;
};

/** How many units of each GPU type (keyed by MergedGpu.key) the user wants to use. */
export type GpuSelection = Record<string, number>;

/** 
 * Scale a resource by a fraction, clamping to min/max. 
 * If the resource is undefined or has no total/max, return 0. 
 * */
function fractionResoruceClamped(resource: ComputeResource | undefined, fraction: number, round?: boolean): number {
  if (!resource) {
    return 0;
  }
  const fractionedResource = (resource.total ?? resource.max ?? 0) * fraction;
  const roundedResource = round ? Math.round(fractionedResource) : fractionedResource;
  if (roundedResource > resource.max) {
    return resource.max;
  }
  if ((resource.min || resource.min === 0) && roundedResource < resource.min) {
    return resource.min;
  }
  return roundedResource;
}

/**
 * Inference always books a whole environment, but the user may choose to use only some of the GPU
 * units — per type. Every other resource (CPU / RAM / disk) and the price scale by the overall
 * fraction of units selected: pick 5 of 6 units → get 5/6 of everything. CPU cores stay whole.
 * Allocation is kept between min/max for each resource type, and the price is calculated based on the actual units selected.
 *
 * When an environment has no GPUs, the fraction is 1 (the whole environment is used).
 */
const useInferenceAllocation = ({
  environment,
  tokenAddress,
  gpuSelection,
  durationSeconds,
}: {
  environment: ComputeEnvironment;
  tokenAddress: string;
  /** Omit to use every unit of every type (the default, whole-environment allocation). */
  gpuSelection?: GpuSelection;
  durationSeconds: number;
}) => {
  const { cpu, cpuFee, disk, diskFee, gpus, gpuFees, ram, ramFee } = useEnvResources({
    environment,
    freeCompute: false,
    tokenAddress,
  });

  // Merge units of the same description into one type, keeping a representative fee.
  const mergedGpus = useMemo<MergedGpu[]>(() => {
    return gpus.reduce((merged, gpu) => {
      const key = gpu.description || 'GPU';
      const existing = merged.find((g) => g.key === key);
      if (existing) {
        existing.max += gpu.max ?? 0;
      } else {
        merged.push({ key, description: gpu.description, max: gpu.max ?? 0 });
      }
      return merged;
    }, [] as MergedGpu[]);
  }, [gpus]);

  const gpuFeeByKey = useMemo<Record<string, number>>(() => {
    // Average fee per type is unnecessary — units of one description share a fee. Take the first.
    const byKey: Record<string, number> = {};
    gpus.forEach((gpu) => {
      const key = gpu.description || 'GPU';
      if (byKey[key] === undefined) {
        byKey[key] = gpuFees[gpu.id] ?? 0;
      }
    });
    return byKey;
  }, [gpus, gpuFees]);

  const totalGpus = useMemo(() => mergedGpus.reduce((sum, g) => sum + g.max, 0), [mergedGpus]);

  // Selected units per type, clamped to what exists. No selection → all units.
  const selectedByKey = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    mergedGpus.forEach((g) => {
      const requested = gpuSelection?.[g.key];
      result[g.key] = requested === undefined ? g.max : Math.min(Math.max(requested, 0), g.max);
    });
    return result;
  }, [mergedGpus, gpuSelection]);

  const selectedTotal = useMemo(
    () => Object.values(selectedByKey).reduce((sum, n) => sum + n, 0),
    [selectedByKey]
  );

  const fraction = totalGpus > 0 ? selectedTotal / totalGpus : 1;

  const allocation = useMemo(() => {
    return {
      cpu: fractionResoruceClamped(cpu, fraction, true),
      ram: fractionResoruceClamped(ram, fraction),
      disk: fractionResoruceClamped(disk, fraction)
    };
  }, [cpu, ram, disk, fraction]);

  const price = useMemo(() => {
    const cpuTotal = (cpuFee ?? 0) * allocation.cpu;
    const ramTotal = (ramFee ?? 0) * allocation.ram;
    const diskTotal = (diskFee ?? 0) * allocation.disk;
    // GPUs are priced by the exact units selected, not the blended fraction.
    const gpuTotal = mergedGpus.reduce((sum, g) => sum + (gpuFeeByKey[g.key] ?? 0) * (selectedByKey[g.key] ?? 0), 0);
    return (cpuTotal + ramTotal + diskTotal + gpuTotal) * (durationSeconds / 60);
  }, [cpuFee, allocation.cpu, allocation.ram, allocation.disk, ramFee, diskFee, mergedGpus, durationSeconds, gpuFeeByKey, selectedByKey]);

  return {
    mergedGpus,
    totalGpus,
    selectedByKey,
    selectedTotal,
    allocation,
    price,
    hasGpus: totalGpus > 0,
  };
};

export default useInferenceAllocation;
