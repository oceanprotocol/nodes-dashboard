import type { ServiceTemplatePublic } from '@oceanprotocol/lib';

/**
 * A launchable app template as served by the node's getServiceTemplates. Identical to the node's
 * public template type — the dashboard adds no fields of its own (launch flags live in the template's
 * `command`, which the node forwards to the container; the web-UI port is `exposedPorts[0]`).
 */
export type AppTemplate = ServiceTemplatePublic;

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
