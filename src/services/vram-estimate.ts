import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { mapQuantization } from '@/services/huggingface-service';
import { ComputeEnvironment } from '@/types/environments';
import {
  HuggingFaceModel,
  HuggingFaceModelConfig,
  InferenceEngine,
  ModelDtype,
  ModelParameters,
  ModelQuantization,
} from '@/types/huggingface';
import { formatGpuLayouts, GpuRequirement, gpuTypesOf } from '@/utils/env-resources';
import { deriveGpuLayouts, estimateHfSizingProfile, legalTpWidths } from '@/utils/service-resources';

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
 * VRAM (GB) the GPU pick puts behind the model: the booked cards of the ONE active group × that group's
 * smallest card. A model shards across identical cards only, so VRAM of another GPU type never counts:
 * a selection spanning two groups (or none, or cards that don't report VRAM) returns null.
 */
export function bookedVramGb(environment: ComputeEnvironment, gpuSelection: GpuSelection | undefined): number | null {
  const active = gpuTypesOf(environment).filter((type) => (gpuSelection?.[type.key] ?? 0) > 0);
  if (active.length !== 1 || active[0].vramGb === undefined) {
    return null;
  }
  return (gpuSelection?.[active[0].key] ?? 0) * active[0].vramGb;
}

/**
 * A short warning when the picked cards don't hold a custom model's estimated layouts (see
 * customModelSizing) — advisory, the "show all GPUs" path is allowed to book them anyway.
 */
export function vramFitMessage(requirement: GpuRequirement, gpuCount: number, bookedGb: number | null): string {
  const picked =
    bookedGb === null
      ? `the ${gpuCount} GPU${gpuCount === 1 ? '' : 's'} picked`
      : `the ${gpuCount} GPU${gpuCount === 1 ? '' : 's'} picked ${gpuCount === 1 ? 'has' : 'have'} ${Math.floor(bookedGb)} GB`;
  return `This model is estimated to need ${formatGpuLayouts(requirement)} (weights plus its context cache); ${picked}. It may fail to load — pick GPUs that fit, lower the context, or use a quantized variant.`;
}

/** Widths sized when a model's attention heads are unknown: every count up to 8 (no width filter). */
const UNKNOWN_HEAD_WIDTHS = [1, 2, 3, 4, 5, 6, 7, 8];
/** Context sized when neither the launch params nor the model config name one. */
const FALLBACK_CONTEXT_TOKENS = 4096;

/** What the custom-model env picker may book, and why (see customModelSizing). */
export type CustomModelSizing = {
  /**
   * Tensor-parallel widths the model's attention heads allow (vendored legalTpWidths over 1/2/4/8) —
   * a HARD filter. Null when they can't be told (heads unknown, or an engine without TP): no width
   * filter, and a note says so.
   */
  widths: number[] | null;
  /**
   * Estimated GPU requirement over those widths (vendored estimateHfSizingProfile → deriveGpuLayouts)
   * — a SOFT filter the picker can drop ("show all GPUs"). Null without an estimate.
   */
  requirement: GpuRequirement | null;
  /** What could not be checked, for the user. */
  notes: string[];
};

/**
 * Size a custom Hugging Face model for the env picker: legal widths from its heads (hard), an estimated
 * per-width VRAM requirement (soft) for the launch settings in `params` — context (`maxContext`, else
 * the model's own), one sequence, `gpuMemoryUtilization`, quantization/dtype and the KV-cache dtype.
 * Recomputed whenever those change. Advisory throughout: nothing here is a measured profile.
 */
export function customModelSizing({
  model,
  config,
  params,
  engine,
}: {
  model: Pick<HuggingFaceModel, 'paramCount' | 'paramsByDtype'>;
  config: HuggingFaceModelConfig | null;
  /** The launch settings when already chosen (back-navigation, a package handoff, the config step). */
  params?: ModelParameters | null;
  engine: InferenceEngine;
}): CustomModelSizing {
  if (engine !== 'vllm' || (params && params.engine !== 'vllm')) {
    return {
      widths: null,
      requirement: null,
      notes: ["llama.cpp splits a model across GPUs by layer, so the GPU count and VRAM aren't checked for it."],
    };
  }
  const vllm = params?.engine === 'vllm' ? params : null;
  const notes: string[] = [];
  const widths = config ? legalTpWidths(config.attention) : null;
  if (!widths) {
    notes.push(
      config
        ? "GPU count not checked for this model: its config doesn't state its attention heads."
        : "GPU count not checked for this model: its config couldn't be read."
    );
  }

  const quantization = vllm?.quantization ?? 'none';
  const dtype = vllm?.dtype ?? 'auto';
  const checkpointQuant = mapQuantization(config?.quantizationMethod ?? null);
  // The safetensors per-dtype counts describe the weights as stored; they are what loads unless the
  // launch re-quantizes them or casts them to another dtype.
  const asStored =
    (quantization === 'none' || quantization === checkpointQuant) && (dtype === 'auto' || !!checkpointQuant);
  const byDtype = asStored ? model.paramsByDtype : undefined;
  const contextFromParams = vllm?.maxContext && vllm.maxContext > 0 ? vllm.maxContext : null;
  const contextTokens = contextFromParams ?? config?.maxContext ?? null;
  const util = vllm?.gpuMemoryUtilization;
  const effectiveDtype = dtype !== 'auto' ? dtype : (config?.torchDtype ?? '').toLowerCase();
  let requirement: GpuRequirement | null = null;
  try {
    const estimate = estimateHfSizingProfile({
      paramsByDtype: byDtype,
      totalParams: model.paramCount,
      bytesPerParam: byDtype
        ? undefined
        : bytesPerParam({
            quantization,
            dtype,
            checkpointQuantization: config?.quantizationMethod,
            torchDtype: config?.torchDtype,
          }),
      numLayers: config?.shape.numHiddenLayers ?? undefined,
      numKvHeads: config?.shape.numKeyValueHeads ?? config?.shape.numAttentionHeads ?? undefined,
      headDim: config?.shape.headDim ?? undefined,
      kvLoraRank: config?.shape.kvLoraRank ?? undefined,
      qkRopeHeadDim: config?.shape.qkRopeHeadDim ?? undefined,
      kvBytes: vllm?.kvCacheDtype === 'fp8' ? 1 : effectiveDtype.includes('32') ? 4 : 2,
      contextTokens: contextTokens ?? FALLBACK_CONTEXT_TOKENS,
      concurrentSeqs: 1,
      memUtil: util !== undefined && util > 0 && util < 1 ? util : 0.9,
      widths: widths ?? UNKNOWN_HEAD_WIDTHS,
    });
    requirement = estimate ? deriveGpuLayouts(estimate.profile) : null;
  } catch (error) {
    console.error('Custom model VRAM estimate failed:', error);
    requirement = null;
  }
  if (!requirement) {
    notes.push("No VRAM estimate for this model (no safetensors parameter count), so GPUs aren't filtered by memory.");
  } else if (contextTokens === null) {
    notes.push(`Context length unknown, so the VRAM estimate assumes ${FALLBACK_CONTEXT_TOKENS} tokens.`);
  }
  return { widths, requirement, notes };
}

/** A short warning when the estimate exceeds the booked VRAM, else null. */
export function vramShortfallMessage(estimateGb: number | null, bookedGb: number | null): string | null {
  if (estimateGb === null || bookedGb === null || bookedGb >= estimateGb) {
    return null;
  }
  return `This model likely needs about ${Math.ceil(estimateGb)} GB of GPU VRAM (weights plus cache); the GPUs picked have ${Math.floor(bookedGb)} GB. It may fail to load — pick more or larger GPUs, or use a quantized variant.`;
}
