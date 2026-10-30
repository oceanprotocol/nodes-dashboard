/**
 * TODO: remove this allowlist once community nodes are allowed to run inference services. Delete the
 * constant and `isInferenceNode`, then remove every call site — the inference env picker
 * (select-inference-environment `isBookableEnv`), the template and package env resolvers
 * (use-template-envs, use-package-env) and the URL-hydration guard (inference-context `restoreEnv`).
 * The subsidized-node chip (subsidized-node-chip) also uses it to limit the chip to OPF nodes; give it
 * its own OPF node list before deleting this one.
 * The remaining per-env checks (`features.services`, benchmark env, supported paid token) are
 * capability tests rather than policy, and must stay.
 */
export const ON_INFERENCE_NODES = [
  '16Uiu2HAmBxtwWEH8m9HLdCJncZGe9Ukj5xLxNhvM5KY17jjz899q',
  '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
  '16Uiu2HAm6pBb3EpA591d1FvjoUnPETAXSH86HjfM3FEwCYPgGtuk',
];

/** Whether a node's peer id is on the inference allowlist. Missing/empty id → not allowed. */
export function isInferenceNode(peerId: string | undefined | null): boolean {
  return !!peerId && ON_INFERENCE_NODES.includes(peerId);
}
