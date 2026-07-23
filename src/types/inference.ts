import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';

export enum InferenceFlowType {
  DefaultModel = 'default-model',
  CustomModel = 'custom-model',
  Template = 'template',
}

/**
 * One resource the package needs to run. `min` is the floor to launch at all; `recommended` is the
 * amount the quick-start flow actually books (custom flow ignores these and lets the user size the
 * env). GPU entries are `kind: 'discrete'` (whole units); cpu/ram/disk are implicitly continuous.
 * All values are amounts in `unit`, resolved against — and clamped to — the live env at launch.
 */
export type ResourceRequirement = {
  /** Resource key: 'cpu' | 'ram' | 'disk' for continuous resources, or 'gpu' when `kind` is set. */
  id: string;
  min: number;
  recommended: number;
  unit: string;
  /** Present only for GPU — marks the resource as booked in whole units. */
  kind?: 'discrete';
  type?: 'gpu';
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
  /** Complete vLLM launch parameters — committed as-is, no config step. */
  params: ModelParameters;
  type: 'quickstart' | 'template'
  /**
   * Peer id of the node this package was fetched from. Not part of the node's template JSON —
   * stamped at load time (see use-default-model-packages) so the details modal knows whose
   * environments to list. Its envs are filtered to those that satisfy `requiredResources`.
   */
  sourcePeerId: string;
  /**
   * Resource floors/recommendations for this package. Quick start books the `recommended` amount of
   * each (clamped to the live env); the custom flow ignores this and lets the user size resources.
   */
  requiredResources: ResourceRequirement[];
};
