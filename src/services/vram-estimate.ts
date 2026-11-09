import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { mapQuantization } from '@/services/huggingface-service';
import { ComputeEnvironment } from '@/types/environments';
import {
  HfModelShape,
  HuggingFaceModel,
  HuggingFaceModelConfig,
  InferenceEngine,
  ModelDtype,
  ModelParameters,
  ModelQuantization,
} from '@/types/huggingface';
import { gpuTypesOf } from '@/utils/env-resources';
import {
  deriveGpuLayouts,
  estimateHfSizingProfile,
  type GpuResourceRequirement,
  legalTpWidths,
} from '@oceanprotocol/lib';

/**
 * A VRAM estimate for a custom Hugging Face model, which — unlike a template or a curated package —
 * declares no recommendation. The env picker filters on it (only environments that hold the estimated
 * layouts are listed) and the config step blocks launch settings that no longer fit the booked GPUs.
 * The inputs are coarse (a parameter count and the config's KV shape, not a measured profile), so the
 * picker lets the user choose the context to size for: the KV cache at the model's full context is
 * often most of the estimate.
 *
 * weights = paramCount × bytes per parameter, from the launch quantization if one is set, else the
 * checkpoint's own quantization, else its dtype (bf16/fp16 = 2, fp32 = 4).
 */
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

/**
 * The context the env picker sizes a custom model for, carried between steps in the `ctx` query param
 * (a token count). Absent = the model's own maximum, which is also what vLLM serves when
 * `--max-model-len` is omitted. The config step pre-fills Max context with it.
 */
export const SIZING_CONTEXT_QUERY_KEY = 'ctx';

/** Context sizes the env picker offers below the model's own maximum. */
export const SIZING_CONTEXT_OPTIONS = [8192, 32768, 131072];

/** The sizing context named in the query, or null (model maximum) when absent or not a positive integer. */
export function sizingContextFromQuery(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
 * Widths sized when a model's attention heads are unknown: only the tensor-parallel counts vLLM
 * actually runs (1, 2, 4, 8). 3/5/6/7 are not valid TP widths, so offering them as "fits" would
 * mislead.
 */
const UNKNOWN_HEAD_WIDTHS = [1, 2, 4, 8];
/** Context sized when neither the launch params nor the model config name one. */
export const FALLBACK_CONTEXT_TOKENS = 4096;

/**
 * The KV cache shape to hand ocean.js's per-layer KV term for `contextTokens`: one per-layer shape
 * (kv heads x head dim) and the number of layers of that shape. Only layers whose cache grows with the
 * context count. Linear-attention / state-space layers keep a small fixed-size state instead: on
 * Qwen3.8-27B that leaves 16 of 64 layers, a 4x smaller cache than counting every layer. The shape is the
 * full-attention layers' (Gemma 4 gives those their own: 4 x 512 against 16 x 256 on the sliding ones),
 * and sliding-window layers are folded in as an equivalent layer count, scaled by the share of the context
 * they keep and by their per-layer size relative to that shape. `numLayers` is undefined when the layer
 * count is unknown or no layer caches the context.
 */
function kvCacheShape(
  shape: HfModelShape | undefined,
  contextTokens: number
): { numLayers?: number; numKvHeads?: number; headDim?: number } {
  const kvHeads = shape?.numKeyValueHeads ?? shape?.numAttentionHeads ?? undefined;
  const headDim = shape?.headDim ?? undefined;
  const fullKvHeads = shape?.fullAttentionKvHeads ?? kvHeads;
  const fullHeadDim = shape?.fullAttentionHeadDim ?? headDim;
  if (!shape?.numHiddenLayers) {
    return { numKvHeads: fullKvHeads, headDim: fullHeadDim };
  }
  const sliding = shape.slidingLayers ?? 0;
  const full = shape.fullAttentionLayers ?? shape.numHiddenLayers - sliding;
  const contextShare = shape.slidingWindow ? Math.min(1, shape.slidingWindow / contextTokens) : 1;
  const sizeRatio =
    kvHeads && headDim && fullKvHeads && fullHeadDim ? (kvHeads * headDim) / (fullKvHeads * fullHeadDim) : 1;
  const layers = full + (sliding > 0 ? Math.ceil(sliding * contextShare * sizeRatio) : 0);
  return { numLayers: layers > 0 ? layers : undefined, numKvHeads: fullKvHeads, headDim: fullHeadDim };
}

/** What the custom-model env picker may book, and why (see customModelSizing). */
export type CustomModelSizing = {
  /**
   * Tensor-parallel widths the model's attention heads allow (ocean.js legalTpWidths over 1/2/4/8) —
   * a HARD filter. Null when they can't be told (heads unknown, or an engine without TP): no width
   * filter, and `gaps` says why.
   */
  widths: number[] | null;
  /**
   * Estimated GPU requirement over those widths (ocean.js estimateHfSizingProfile → deriveGpuLayouts)
   * — also a HARD filter: environments that can't hold any layout are not listed. Null without an
   * estimate (no memory filter, and `gaps.noEstimate`).
   */
  requirement: GpuResourceRequirement | null;
  /** What could not be checked, for the picker to explain. */
  gaps: CustomModelSizingGaps;
};

/** Checks customModelSizing could not make, each shown to the user as a note. */
export type CustomModelSizingGaps = {
  /** llama.cpp splits a model by layer: neither the GPU count nor VRAM is checked. */
  llamaCpp: boolean;
  /** config.json couldn't be read: no GPU-count check. */
  configUnreadable: boolean;
  /** config.json names no attention heads: no GPU-count check. */
  headsUnknown: boolean;
  /** No estimate (no safetensors parameter count): no memory filter. */
  noEstimate: boolean;
  /** Neither the launch params nor the config name a context, so FALLBACK_CONTEXT_TOKENS was sized. */
  contextAssumed: boolean;
};

const NO_GAPS: CustomModelSizingGaps = {
  llamaCpp: false,
  configUnreadable: false,
  headsUnknown: false,
  noEstimate: false,
  contextAssumed: false,
};

/**
 * Size a custom Hugging Face model for the env picker: legal widths from its heads (hard), an estimated
 * per-width VRAM requirement (hard) for the launch settings in `params` — context (`contextTokens`, else
 * `maxContext`, else the model's own), one sequence, `gpuMemoryUtilization`, quantization/dtype and the
 * KV-cache dtype. Recomputed whenever those change. An estimate, not a measured profile.
 */
export function customModelSizing({
  model,
  config,
  params,
  engine,
  contextTokens: contextOverride,
}: {
  model: Pick<HuggingFaceModel, 'paramCount' | 'paramsByDtype'>;
  config: HuggingFaceModelConfig | null;
  /** The launch settings when already chosen (back-navigation, a package handoff, the config step). */
  params?: ModelParameters | null;
  engine: InferenceEngine;
  /** Context to size for, over `params.maxContext` — the env picker's choice (see SIZING_CONTEXT_QUERY_KEY). */
  contextTokens?: number | null;
}): CustomModelSizing {
  if (engine !== 'vllm' || (params && params.engine !== 'vllm')) {
    return {
      widths: null,
      requirement: null,
      gaps: { ...NO_GAPS, llamaCpp: true },
    };
  }
  const vllm = params?.engine === 'vllm' ? params : null;
  const widths = config ? legalTpWidths(config.attention) : null;

  const quantization = vllm?.quantization ?? 'none';
  const dtype = vllm?.dtype ?? 'auto';
  const checkpointQuant = mapQuantization(config?.quantizationMethod ?? null);
  // The safetensors per-dtype counts describe the weights as stored; they are what loads unless the
  // launch re-quantizes them or casts them to another dtype.
  const asStored =
    (quantization === 'none' || quantization === checkpointQuant) && (dtype === 'auto' || !!checkpointQuant);
  const byDtype = asStored ? model.paramsByDtype : undefined;
  const contextFromParams = vllm?.maxContext && vllm.maxContext > 0 ? vllm.maxContext : null;
  const contextTokens =
    (contextOverride && contextOverride > 0 ? contextOverride : null) ??
    contextFromParams ??
    config?.maxContext ??
    null;
  const util = vllm?.gpuMemoryUtilization;
  const effectiveDtype = dtype !== 'auto' ? dtype : (config?.torchDtype ?? '').toLowerCase();
  let requirement: GpuResourceRequirement | null = null;
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
      ...kvCacheShape(config?.shape, contextTokens ?? FALLBACK_CONTEXT_TOKENS),
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
  return {
    widths,
    requirement,
    gaps: {
      ...NO_GAPS,
      configUnreadable: !config,
      headsUnknown: !!config && !widths,
      noEstimate: !requirement,
      contextAssumed: !!requirement && contextTokens === null,
    },
  };
}

/**
 * The largest context (a multiple of `step` tokens, between `floor` and `ceiling`) at which `fits` holds,
 * or null when it fails even at `floor`. `fits` must be monotonic: true up to some context, false past it.
 */
export function maxFittingContext(
  fits: (contextTokens: number) => boolean,
  floor: number,
  ceiling: number,
  step = 1024
): number | null {
  if (ceiling < floor || !fits(floor)) {
    return null;
  }
  if (fits(ceiling)) {
    return ceiling;
  }
  let lo = floor;
  let hi = ceiling;
  while (hi - lo > step) {
    const mid = lo + Math.floor((hi - lo) / 2 / step) * step || lo + step;
    if (fits(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}
