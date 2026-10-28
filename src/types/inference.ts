import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
import type { GpuLayout } from '@/utils/env-resources';

export enum InferenceFlowType {
  DefaultModel = 'default-model',
  CustomModel = 'custom-model',
  Template = 'template',
}

/**
 * One resource the package recommends. There is no minimum: `recommended` is the amount the quick-start
 * flow books (custom flow ignores these and lets the user size the env). For cpu/ram/disk it is
 * clamped to what the live env can grant; for GPU it is the TOTAL VRAM in GB, booked as one of its
 * `layouts` on cards whose `memoryTotal` holds the layout's share — an env that can't is not offered.
 */
export type ResourceRequirement = {
  /** Resource key: 'cpu' | 'ram' | 'disk' for continuous resources, or 'gpu' when `kind` is set. */
  id: string;
  recommended: number;
  unit: string;
  /** Present only for GPU — marks the resource as booked in whole units. */
  kind?: 'discrete';
  type?: 'gpu';
  /** GPU only: the card counts it may be booked as — for a package, its one pinned TP width. */
  layouts?: GpuLayout[];
  description?: string;
};

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
};
