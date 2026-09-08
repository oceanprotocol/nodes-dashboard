/**
 * TODO: remove this allowlist once community nodes are allowed to run inference services. Delete the
 * constant and `isInferenceNode`, then remove every call site — the inference env picker
 * (select-inference-environment `isBookableEnv`), the template and package env resolvers
 * (use-template-envs, use-package-env) and the URL-hydration guard (inference-context `restoreEnv`).
 * The remaining per-env checks (`features.services`, benchmark env, supported paid token) are
 * capability tests rather than policy, and must stay.
 */
export const ON_INFERENCE_NODES = [
  '16Uiu2HAm94yL3Sjem2piKmGkiHCdJyTn3F3aWueZTXKT38ekjuzr',
  '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
];

/** Whether a node's peer id is on the inference allowlist. Missing/empty id → not allowed. */
export function isInferenceNode(peerId: string | undefined | null): boolean {
  return !!peerId && ON_INFERENCE_NODES.includes(peerId);
}
