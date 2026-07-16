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
  /** Fee token address to pay in (must be one the env accepts). */
  tokenAddress: string;
};

/**
 * A curated quick-start bundle: model + complete launch parameters + a pinned environment,
 * launchable as-is with no config or resource step. The model id must be a real (ungated) Hugging
 * Face repo — URL hydration on the payment page re-fetches the model by id on a hard reload.
 */
export type InferencePackage = {
  /** Stable slug — used as the payment route param and to restore the pick from the URL. */
  id: string;
  /** Static snapshot of the Hugging Face model this package serves. */
  model: HuggingFaceModel;
  /** Complete vLLM launch parameters — committed as-is, no config step. */
  params: ModelParameters;
  /** The pinned environment to run on — resolved live from the environments API by id. */
  env: InferencePackageEnv;
};
