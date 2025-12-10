import { CHAIN_ID } from '@/constants/chains';
import useTokenSymbol from '@/lib/token-symbol';
import { ComputeEnvironment, ComputeResource } from '@/types/environments';
import { useMemo, useState } from 'react';

type UseEnvResources = {
  cpu?: ComputeResource;
  cpuFee?: number;
  disk?: ComputeResource;
  diskFee?: number;
  gpus: ComputeResource[];
  gpuFees: Record<string, number>;
  ram?: ComputeResource;
  ramFee?: number;
  setTokenAddress: (token: string) => void;
  supportedTokens: string[];
  tokenAddress: string;
  tokenSymbol: string | null;
};

const useEnvResources = (environment: ComputeEnvironment): UseEnvResources => {
  const { fees, supportedTokens } = useMemo(() => {
    const fees = environment.fees[CHAIN_ID];
    if (!fees) {
      return { fees: [], supportedTokens: [] };
    }
    const supportedTokens = fees.map((fee) => fee.feeToken);
    return { fees, supportedTokens };
  }, [environment.fees]);

  const [tokenAddress, setTokenAddress] = useState(supportedTokens[0]);
  const tokenSymbol = useTokenSymbol(tokenAddress);

  const selectedTokenFees = useMemo(() => fees.find((fee) => fee.feeToken === tokenAddress), [fees, tokenAddress]);

  const { cpu, disk, gpus, ram } = useMemo(() => {
    const cpu = environment.resources?.find((res) => res.type === 'cpu' || res.id === 'cpu');
    const disk = environment.resources?.find((res) => res.type === 'disk' || res.id === 'disk');
    const gpus = environment.resources?.filter((res) => res.type === 'gpu' || res.id === 'gpu') ?? [];
    const ram = environment.resources?.find((res) => res.type === 'ram' || res.id === 'ram');
    return { cpu, disk, gpus, ram };
  }, [environment.resources]);

  const { cpuFee, diskFee, ramFee } = useMemo(() => {
    const cpuId = cpu?.id;
    const diskId = disk?.id;
    const ramId = ram?.id;
    const cpuFee = selectedTokenFees?.prices.find((price) => price.id === cpuId)?.price;
    const diskFee = selectedTokenFees?.prices.find((price) => price.id === diskId)?.price;
    const ramFee = selectedTokenFees?.prices.find((price) => price.id === ramId)?.price;
    return { cpuFee, diskFee, ramFee };
  }, [cpu?.id, disk?.id, ram?.id, selectedTokenFees?.prices]);

  const gpuFees = useMemo(() => {
    const fees: Record<string, number> = {};
    if (selectedTokenFees) {
      const gpuIds = gpus.map((gpu) => gpu.id);
      gpus.forEach((gpu) => {
        const fee = selectedTokenFees.prices.find((price) => gpuIds.includes(price.id))?.price;
        if (fee !== undefined) {
          fees[gpu.id] = fee;
        }
      });
    }
    return fees;
  }, [selectedTokenFees, gpus]);

  return {
    cpu,
    cpuFee,
    disk,
    diskFee,
    gpus,
    gpuFees,
    ram,
    ramFee,
    setTokenAddress,
    supportedTokens,
    tokenAddress,
    tokenSymbol,
  };
};

export default useEnvResources;
