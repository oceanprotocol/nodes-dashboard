import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';

export enum InferenceFlowType {
  DefaultModel = 'default-model',
  CustomModel = 'custom-model',
  Template = 'template',
}

/**
 * A specific environment a package runs on, pinned by id — the same selection the custom flow
 * commits when a user picks an env card, but hardcoded. The live ComputeEnvironment + node info
 * are resolved from the environments API by these ids at selection time (the env's real resources,
 * fees and availability aren't stored here — only which env to book).
 */
export type InferencePackageEnv = {
  /** Peer id of the node hosting the environment. */
  peerId: string;
  /**
   * Stable environment identity: the id PREFIX (the part before `-`). The full id's suffix rotates
   * per epoch, so we match on the prefix — same fallback the URL hydration uses.
   */
  envIdPrefix: string;
  /** Units to book per GPU type, keyed by the env's GPU `description` (e.g. `"NVIDIA H200"`). */
  gpuSelection: Record<string, number>;
};

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
  /** The pinned environment to run on — resolved live from the environments API by id. */
  env: InferencePackageEnv;
  /**
   * Resource floors/recommendations for this package. Quick start books the `recommended` amount of
   * each (clamped to the live env); the custom flow ignores this and lets the user size resources.
   */
  requiredResources: ResourceRequirement[];
};
