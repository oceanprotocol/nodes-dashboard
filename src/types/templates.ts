import type { ServiceTemplatePublic } from '@oceanprotocol/lib';

/** The workflow graph shipped by a template — each template ships exactly one. */
export interface TemplateWorkflow {
  id: string; // [A-Za-z0-9_.-]+ — also the ?template= value ComfyUI deep-links to
  name: string;
  description?: string;
  graph?: unknown;
}

/**
 * Catalogue classification the node publishes alongside a template. These fields exist in
 * ocean-node's `ServiceTemplateSchema` but not (yet) in ocean.js's `ServiceTemplatePublic`, so they
 * are declared here and reach us through the node's sanitizer, which spreads unknown fields
 * verbatim. Drop this block once ocean.js mirrors them.
 */

/**
 * How an entry presents itself. Absent means `service` — every entry published before this field.
 *
 * Identifiers in this codebase follow the WIRE (`template` = any entry, `service` / `bundle` = the two
 * kinds); the product words the user reads ("Service" / "Template") live only in the catalogue copy,
 * see components/inference/catalogue-config.tsx.
 */
export type AppTemplateKind = 'service' | 'bundle';

/** Filter axis of the catalogue. Closed set, so buckets stay consistent across nodes. */
export type AppTemplateCategory = 'image' | 'video' | 'llm' | 'serving' | 'notebook' | 'embeddings' | 'app';

/** One thing a bundle pre-downloads. Display metadata: the template's own `command` does the fetching. */
export type TemplateIncludedItem = {
  name: string;
  kind: 'model' | 'workflow' | 'customnode' | 'other';
  /** Hugging Face repo id, when the item is a plain HF repo — gives us the publisher avatar + a link. */
  repoId?: string;
  /** Direct download URL for anything that isn't a plain HF repo (CivitAI, mirrors). */
  url?: string;
};

type BundleFields = {
  kind?: AppTemplateKind;
  /** Bundles only: id of the service template this is a variant of. May not exist on this node. */
  service?: string;
  /** Bundles only: the one concrete thing this gets done. */
  outcome?: string;
  category?: AppTemplateCategory;
  /** Bundles only: manifest of what `command` downloads. */
  includes?: TemplateIncludedItem[];
};

/** One user-supplied env var, plus the node's `required` hint (also missing from the ocean.js type). */
export type AppEnvVarSpec = NonNullable<ServiceTemplatePublic['userConfigurableEnvVars']>[number] & {
  /** The app can't do its job without it (e.g. HF_TOKEN for a gated model) — drives the config step. */
  required?: boolean;
};

/**
 * A launchable app as served by the node's getServiceTemplates — a bare **service** or a **bundle**
 * (the same app whose `command` pre-downloads a curated model set). Launch flags live in the
 * template's `command`, which the node forwards to the container; the web-UI port is `exposedPorts[0]`.
 */
export type AppTemplate = Omit<ServiceTemplatePublic, 'userConfigurableEnvVars'> &
  BundleFields & {
    userConfigurableEnvVars?: AppEnvVarSpec[];
    /** The workflow graphs the template installs — reaches us through the node's sanitizer spread. */
    workflows?: TemplateWorkflow[];
  };

/** A bundle — narrowed so `service` is known present (the node's schema requires it on bundles). */
export type AppBundle = AppTemplate & { kind: 'bundle'; service: string };

export function isBundle(tpl: AppTemplate): tpl is AppBundle {
  return tpl.kind === 'bundle' && typeof tpl.service === 'string' && tpl.service.length > 0;
}

/** Everything that isn't a bundle, including every template published before `kind` existed. */
export function isService(tpl: AppTemplate): boolean {
  return !isBundle(tpl);
}

/**
 * "3 models" — one-line summary of what a bundle brings, for cards and section heads. Counts only:
 * download sizes are deliberately not part of the manifest (they can't be kept honest by hand, and
 * the node never verifies them), so we don't quote a GB figure or a setup time anywhere.
 */
export function includesSummary(tpl: AppTemplate): string | null {
  const items = tpl.includes ?? [];
  if (items.length === 0) {
    return null;
  }
  const models = items.filter((i) => i.kind === 'model').length;
  const noun = models > 0 ? (models === 1 ? 'model' : 'models') : items.length === 1 ? 'item' : 'items';
  const count = models > 0 ? models : items.length;
  return `${count} ${noun}`;
}

/**
 * Hugging Face repo id of an included item — declared, else parsed from a huggingface.co URL
 * (`https://huggingface.co/<owner>/<repo>/resolve/...`). Used for the publisher avatar and the link.
 */
export function includedRepoId(item: TemplateIncludedItem): string | undefined {
  if (item.repoId) {
    return item.repoId;
  }
  if (!item.url) {
    return undefined;
  }
  const match = /^https:\/\/huggingface\.co\/([^/]+)\/([^/]+)\//.exec(item.url);
  return match ? `${match[1]}/${match[2]}` : undefined;
}

/** Env vars the user MUST supply before this template can work — drives whether the config step shows. */
export function requiredEnvVars(tpl: AppTemplate): AppEnvVarSpec[] {
  return (tpl.userConfigurableEnvVars ?? []).filter((spec) => spec.required === true);
}

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
