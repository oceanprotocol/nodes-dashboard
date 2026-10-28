import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ComputeEnvironment } from '@/types/environments';
import { HuggingFaceModel, ModelDtype, ModelQuantization } from '@/types/huggingface';
import { gpuTypesOf } from '@/utils/env-resources';

/**
 * A rough VRAM estimate for a custom Hugging Face model, which — unlike a template or a curated package —
 * declares no recommendation. It is ADVISORY ONLY: the env picker and the config step use it to warn that
 * a pick is likely too small, never to hide or block one, because the inputs are coarse (a parameter
 * count, not a measured profile) and a model can legitimately run tighter (short context, eager mode).
 *
 * weights = paramCount × bytes per parameter, from the launch quantization if one is set, else the
 * checkpoint's own quantization, else its dtype (bf16/fp16 = 2, fp32 = 4). The total adds 20% for the
 * KV cache, activations and CUDA graphs, and divides by `gpuMemoryUtilization` — the share of each card
 * vLLM is allowed to claim.
 */
const RUNTIME_HEADROOM = 1.2;

function bytesPerParam({
  quantization,
  dtype,
  checkpointQuantization,
  torchDtype,
}: {
  quantization?: ModelQuantization;
  dtype?: ModelDtype;
  checkpointQuantization?: string | null;
  torchDtype?: string | null;
}): number {
  const quant = quantization && quantization !== 'none' ? quantization : (checkpointQuantization ?? '').toLowerCase();
  if (quant.includes('fp8')) {
    return 1;
  }
  if (quant.includes('awq') || quant.includes('gptq') || quant.includes('int4') || quant.includes('bitsandbytes')) {
    // 4-bit weights plus their scales and zero points.
    return 0.55;
  }
  const effectiveDtype = dtype && dtype !== 'auto' ? dtype : (torchDtype ?? '').toLowerCase();
  return effectiveDtype.includes('32') ? 4 : 2;
}

export type VramEstimateInput = {
  paramCount?: number;
  quantization?: ModelQuantization;
  dtype?: ModelDtype;
  checkpointQuantization?: string | null;
  torchDtype?: string | null;
  gpuMemoryUtilization?: number;
};

/** Estimated total VRAM (decimal GB, across all cards) to serve the model; null when it can't be told. */
export function estimateModelVramGb(input: VramEstimateInput): number | null {
  if (!input.paramCount || input.paramCount <= 0) {
    return null;
  }
  const util = input.gpuMemoryUtilization && input.gpuMemoryUtilization > 0 ? input.gpuMemoryUtilization : 0.9;
  const weightsGb = (input.paramCount * bytesPerParam(input)) / 1e9;
  return (weightsGb * RUNTIME_HEADROOM) / util;
}

/** The custom flow's models, summed: each runs its own server on the same booked GPUs. */
export function estimateModelsVramGb(models: Pick<HuggingFaceModel, 'paramCount'>[]): number | null {
  const estimates = models.map((m) => estimateModelVramGb({ paramCount: m.paramCount }));
  if (estimates.length === 0 || estimates.some((e) => e === null)) {
    return null;
  }
  return estimates.reduce<number>((sum, e) => sum + (e ?? 0), 0);
}

/**
 * VRAM (GB) the GPU pick puts behind the model: booked cards × the smallest card of each type. Null when
 * no GPU is picked or a picked type doesn't report its VRAM.
 */
export function bookedVramGb(environment: ComputeEnvironment, gpuSelection: GpuSelection | undefined): number | null {
  let total = 0;
  let booked = 0;
  for (const type of gpuTypesOf(environment)) {
    const units = gpuSelection?.[type.key] ?? 0;
    if (units <= 0) {
      continue;
    }
    if (type.vramGb === undefined) {
      return null;
    }
    total += units * type.vramGb;
    booked += units;
  }
  return booked > 0 ? total : null;
}

/** A short warning when the estimate exceeds the booked VRAM, else null. */
export function vramShortfallMessage(estimateGb: number | null, bookedGb: number | null): string | null {
  if (estimateGb === null || bookedGb === null || bookedGb >= estimateGb) {
    return null;
  }
  return `This model likely needs about ${Math.ceil(estimateGb)} GB of GPU VRAM (weights plus cache); the GPUs picked have ${Math.floor(bookedGb)} GB. It may fail to load — pick more or larger GPUs, or use a quantized variant.`;
}
