import type { ServiceTemplatePublic } from '@oceanprotocol/lib';

/** The workflow graph shipped by a template — each template ships exactly one. */
export interface TemplateWorkflow {
  id: string; // [A-Za-z0-9_.-]+ — also the ?template= value ComfyUI deep-links to
  name: string;
  description?: string;
  graph?: unknown;
}

/**
 * A launchable app template as served by the node's getServiceTemplates. Otherwise identical to the
 * node's public template type (launch flags live in the template's `command`, which the node forwards
 * to the container; the web-UI port is `exposedPorts[0]`) — `workflows` is the one dashboard-side addition.
 */
// ponytail: local shim — @oceanprotocol/lib 9.0.0-next.7 predates these fields. Delete the
// intersection (and TemplateWorkflow) once the pin moves to next.8, which ships them natively.
export type AppTemplate = ServiceTemplatePublic & { workflows?: TemplateWorkflow[] };

/** Validate a user-supplied env-var value against the template's optional regex. Empty = valid (optional field). */
export function validateEnvValue(spec: { validation?: string }, value: string): boolean {
  if (!value) {
    return true;
  }
  if (!spec.validation) {
    return true;
  }
  try {
    return new RegExp(spec.validation).test(value);
  } catch {
    // A template that ships an invalid regex shouldn't block the user — treat as no constraint.
    return true;
  }
}
