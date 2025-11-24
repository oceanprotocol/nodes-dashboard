import { CHAIN_ID } from '@/constants/chains';
import { useOceanContext } from '@/context/ocean-context';
import { ComputeEnvironment, ComputeResource } from '@/types/environments';
import { useEffect, useMemo, useState } from 'react';

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
  const { getSymbolByAddress } = useOceanContext();

  const { fees, supportedTokens } = useMemo(() => {
    const fees = environment.fees[CHAIN_ID];
    if (!fees) {
      return { fees: [], supportedTokens: [] };
    }
    const supportedTokens = fees.map((fee) => fee.feeToken);
    return { fees, supportedTokens };
  }, [environment.fees]);

  const [tokenAddress, setTokenAddress] = useState(supportedTokens[0]);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);

  useEffect(() => {
    setTokenSymbol(null);
    getSymbolByAddress(tokenAddress).then((symbol) => setTokenSymbol(symbol));
  }, [getSymbolByAddress, tokenAddress]);

  const selectedTokenFees = useMemo(() => fees.find((fee) => fee.feeToken === tokenAddress), [fees, tokenAddress]);

  const { cpu, disk, gpus, ram } = useMemo(() => {
    const cpu = environment.resources?.find((res) => res.id === 'cpu');
    const disk = environment.resources?.find((res) => res.id === 'disk');
    const gpus = environment.resources?.filter((res) => !['cpu', 'disk', 'ram'].includes(res.id)) ?? [];
    const ram = environment.resources?.find((res) => res.id === 'ram');
    return { cpu, disk, gpus, ram };
  }, [environment.resources]);

  const { cpuFee, diskFee, ramFee } = useMemo(() => {
    const cpuFee = selectedTokenFees?.prices.find((price) => price.id === 'cpu')?.price;
    const diskFee = selectedTokenFees?.prices.find((price) => price.id === 'disk')?.price;
    const ramFee = selectedTokenFees?.prices.find((price) => price.id === 'ram')?.price;
    return { cpuFee, diskFee, ramFee };
  }, [selectedTokenFees]);

  const gpuFees = useMemo(() => {
    const fees: Record<string, number> = {};
    if (selectedTokenFees) {
      gpus.forEach((gpu) => {
        const fee = selectedTokenFees.prices.find((price) => price.id === gpu.id)?.price;
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
