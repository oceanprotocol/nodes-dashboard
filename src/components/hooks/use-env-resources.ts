import { CHAIN_ID } from '@/constants/chains';
import { ComputeEnvironment, ComputeResource } from '@/types/environments';
import { useMemo } from 'react';

type UseEnvResources = {
  cpu?: ComputeResource;
  cpuFee?: number;
  disk?: ComputeResource;
  diskFee?: number;
  gpus: ComputeResource[];
  gpuFees: Record<string, number>;
  maxJobDurationSeconds?: number;
  minJobDurationSeconds?: number;
  ram?: ComputeResource;
  ramFee?: number;
  supportedTokens: string[];
};

const useEnvResources = ({
  environment,
  freeCompute,
  tokenAddress,
}: {
  environment: ComputeEnvironment;
  freeCompute: boolean;
  tokenAddress: string;
}): UseEnvResources => {
  const { fees, supportedTokens } = useMemo(() => {
    try {
      const fees = environment.fees[CHAIN_ID];
      if (!fees) {
        return { fees: [], supportedTokens: [] };
      }
      const supportedTokens = fees.map((fee) => fee.feeToken);
      return { fees, supportedTokens };
    } catch (error) {
      console.error('Error processing fees:', error);
      return { fees: [], supportedTokens: [] };
    }
  }, [environment.fees]);

  const selectedTokenFees = useMemo(() => fees.find((fee) => fee.feeToken === tokenAddress), [fees, tokenAddress]);

  const { cpu, disk, gpus, ram } = useMemo(() => {
    try {
      let cpu = environment.resources?.find((res) => res.type === 'cpu' || res.id === 'cpu');
      let disk = environment.resources?.find((res) => res.type === 'disk' || res.id === 'disk');
      let gpus = environment.resources?.filter((res) => res.type === 'gpu' || res.id === 'gpu') ?? [];
      let ram = environment.resources?.find((res) => res.type === 'ram' || res.id === 'ram');
      if (freeCompute) {
        // only keep resources that are available for free compute
        // and update their max / inUse values
        const freeResources = environment.free?.resources ?? [];
        if (cpu) {
          const freeCpu = freeResources.find((res) => res.id === cpu!.id);
          cpu = freeCpu ? { ...cpu, ...freeCpu } : undefined;
        }
        if (disk) {
          const freeDisk = freeResources.find((res) => res.id === disk!.id);
          disk = freeDisk ? { ...disk, ...freeDisk } : undefined;
        }
        if (ram) {
          const freeRam = freeResources.find((res) => res.id === ram!.id);
          ram = freeRam ? { ...ram, ...freeRam } : undefined;
        }
        if (gpus.length > 0) {
          const newGpus = [];
          for (const gpu of gpus) {
            const freeGpu = freeResources.find((res) => res.id === gpu.id);
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
  }, [environment.free?.resources, environment.resources, freeCompute]);

  const { cpuFee, diskFee, ramFee } = useMemo(() => {
    try {
      if (freeCompute) {
        return { cpuFee: 0, diskFee: 0, ramFee: 0 };
      }
      const cpuId = cpu?.id;
      const diskId = disk?.id;
      const ramId = ram?.id;
      const cpuFee = selectedTokenFees?.prices.find((price) => price.id === cpuId)?.price;
      const diskFee = selectedTokenFees?.prices.find((price) => price.id === diskId)?.price;
      const ramFee = selectedTokenFees?.prices.find((price) => price.id === ramId)?.price;
      return { cpuFee, diskFee, ramFee };
    } catch (error) {
      console.error('Error processing fees:', error);
      return { cpuFee: undefined, diskFee: undefined, ramFee: undefined };
    }
  }, [cpu?.id, disk?.id, freeCompute, ram?.id, selectedTokenFees?.prices]);

  const gpuFees = useMemo(() => {
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
  }, [freeCompute, selectedTokenFees, gpus]);

  const { maxJobDurationSeconds, minJobDurationSeconds } = useMemo(() => {
    const maxJobDurationSeconds =
      freeCompute && environment.free?.maxJobDuration
        ? environment.free.maxJobDuration
        : (environment.maxJobDuration ?? 0);
    const minJobDurationSeconds =
      freeCompute && environment.free?.minJobDuration
        ? environment.free.minJobDuration
        : (environment.minJobDuration ?? 0);
    return { maxJobDurationSeconds, minJobDurationSeconds };
  }, [
    environment.free?.maxJobDuration,
    environment.free?.minJobDuration,
    environment.maxJobDuration,
    environment.minJobDuration,
    freeCompute,
  ]);

  return {
    cpu,
    cpuFee,
    disk,
    diskFee,
    gpus,
    gpuFees,
    maxJobDurationSeconds,
    minJobDurationSeconds,
    ram,
    ramFee,
    supportedTokens,
  };
};

export default useEnvResources;
