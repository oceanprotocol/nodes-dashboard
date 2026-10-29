import { HuggingFaceModel, ModelParameters, VllmParameters } from '@/types/huggingface';
import type { DeclaredRequirement } from '@/utils/env-resources';
import type { GpuSizingProfile } from '@/utils/service-resources';

export enum InferenceFlowType {
  DefaultModel = 'default-model',
  CustomModel = 'custom-model',
  Template = 'template',
}

/**
 * One resource the package recommends — the same strict union a node template carries (cpu/ram/disk by
 * `id`, the GPU entry by `kind: 'discrete', type: 'gpu'`, with no `id`). There is no minimum:
 * `recommended` is the amount the quick-start flow books. For cpu/ram/disk it is clamped to what the
 * live env can grant; for GPU it is the TOTAL VRAM in GB, booked as one of its `layouts` on cards whose
 * `memoryTotal` holds the layout's share — an env that can't is not offered.
 */
export type ResourceRequirement = DeclaredRequirement;

/**
 * A curated quick-start bundle: model + complete launch parameters + a pinned environment,
 * launchable as-is with no config or resource step. The model id must be a real (ungated) Hugging
 * Face repo — the payment page re-fetches the model by id on a hard reload.
 */
export type InferencePackage = {
  /** Stable slug — used as the payment route param and to restore the pick from the URL. */
  id: string;
  /**
   * Minimal model snapshot — only what the card + modal render (`id`, `author`, `pipelineTag`).
   * A sparsely-filled `HuggingFaceModel`; the full model is fetched by id when the package is opened.
   */
  model: HuggingFaceModel;
  /**
   * Short human blurb — why this package is worth picking. Rendered on the package card, clamped to
   * two lines. Optional: node-advertised templates may not carry one.
   */
  description?: string;
  /** Complete vLLM launch parameters — committed as-is, no config step. */
  params: ModelParameters;
  type: 'quickstart' | 'template'
  /**
   * Peer ids of the nodes this package can run on. For a template fetched from a node this holds
   * that single node (stamped at load time — see use-default-model-packages; the template JSON
   * carries no peer id); for a curated mock it lists every node it may be launched on. The details
   * modal lists all of these nodes' envs, filtered to those that reach the recommended GPU VRAM.
   */
  sourcePeerIds: string[];
  /**
   * Resource recommendations for this package. Quick start books the `recommended` amount of each
   * (cpu/ram/disk clamped to the live env, GPU as total VRAM); the custom flow ignores this and lets the
   * user size resources.
   */
  recommendedResources: ResourceRequirement[];
  /**
   * How the package's GPU need scales with the card count. When set, the GPU entry's layouts are
   * DERIVED from it (vendored deriveGpuLayouts) and the package may launch on any of its widths — the
   * planner picks the cheapest that fits, and the launch sets `tensorParallelSize` to the booked width.
   * Absent: the package stays pinned to its own `params.tensorParallelSize` (one layout).
   */
  sizing?: GpuSizingProfile;
  /**
   * Launch-param patches per booked width (merged over `params` when that width is booked), for knobs
   * tuned to a width — e.g. a concurrency cap that only fits on fewer cards. Only read with `sizing`.
   */
  perWidthParams?: Record<number, Partial<VllmParameters>>;
};
