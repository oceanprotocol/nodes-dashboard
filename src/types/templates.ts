import type { ServiceTemplatePublic } from '@oceanprotocol/lib';

/**
 * Templates flow = launch a containerized APP (not an HF model). A template is a preset that fills
 * ServiceStartParams (image + ports + command + user env vars + resource floors). It launches on any
 * service-capable environment — the env does NOT need to "own" the template (ocean-node's serviceStart
 * takes the image directly; templates are just presets, same as the vLLM path already does).
 *
 * `AppTemplate` extends ocean.js's node-served `ServiceTemplatePublic` (identical shape to ocean-node's
 * ServiceTemplate, minus operator envVars values) with two dashboard-only concerns:
 *  - `fixedEnvVars`: operator-fixed env vars merged into userData at launch. ServiceTemplatePublic strips
 *    envVars VALUES (keys only), so a dashboard-bundled template carries them here instead (e.g. ComfyUI's
 *    CLI_ARGS that must bind 0.0.0.0 or the forwarded port is unreachable).
 *  - presentation hints (`primaryPort`, `category`, `icon`) for the card + the "Open UI" link.
 *
 * When the node catalog API is wired (getServiceTemplates), a fetched ServiceTemplatePublic is an
 * AppTemplate with `fixedEnvVars`/presentation simply absent — the type is a superset, so both sources merge.
 */
export type AppTemplateCategory = 'image-gen' | 'notebook' | 'llm-ui' | 'other';

export type AppTemplate = ServiceTemplatePublic & {
  /** Operator-fixed env vars merged into userData at launch; not user-editable. */
  fixedEnvVars?: Record<string, string>;
  /** Exposed port serving the primary web UI — drives the "Open" link on the service page. Defaults to exposedPorts[0]. */
  primaryPort?: number;
  category?: AppTemplateCategory;
  /** MUI icon key or emoji for the template card. */
  icon?: string;
};

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
