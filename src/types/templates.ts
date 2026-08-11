import type { ServiceTemplatePublic, ServiceTemplateWorkflow } from '@oceanprotocol/lib';

export type TemplateWorkflow = ServiceTemplateWorkflow;

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
  /** Download size — drives the "N models, X GB" line and the session-length hint. */
  sizeGb?: number;
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
 * `workflows` comes from `ServiceTemplatePublic` itself as of @oceanprotocol/lib 9.0.0-next.9 — only
 * the fields the lib still lacks are declared here.
 */
export type AppTemplate = Omit<ServiceTemplatePublic, 'userConfigurableEnvVars'> &
  BundleFields & {
    userConfigurableEnvVars?: AppEnvVarSpec[];
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

/** Total download size of a bundle's contents, or undefined when no entry declares one. */
export function includedSizeGb(tpl: AppTemplate): number | undefined {
  const sizes = (tpl.includes ?? []).map((i) => i.sizeGb).filter((s): s is number => typeof s === 'number');
  return sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) : undefined;
}

/** "3 models · 11.5 GB" — one-line summary of what a bundle brings, for cards and section heads. */
export function includesSummary(tpl: AppTemplate): string | null {
  const items = tpl.includes ?? [];
  if (items.length === 0) {
    return null;
  }
  const models = items.filter((i) => i.kind === 'model').length;
  const noun = models > 0 ? (models === 1 ? 'model' : 'models') : items.length === 1 ? 'item' : 'items';
  const count = models > 0 ? models : items.length;
  const size = includedSizeGb(tpl);
  return size != null ? `${count} ${noun} · ${size.toFixed(1)} GB` : `${count} ${noun}`;
}

/** Assumed sustained download rate, in MB/s — what the compute nodes we measured hold with aria2c. */
const DOWNLOAD_MB_PER_SECOND = 25;

/**
 * Rough download time for a bundle's contents. An estimate, not a promise: the real rate depends on
 * the node's uplink and Hugging Face's CDN, so callers should word it as one ("roughly N min").
 */
export function estimatedSetupMinutes(tpl: AppTemplate): number | null {
  const size = includedSizeGb(tpl);
  if (size == null || size <= 0) {
    return null;
  }
  return Math.max(1, Math.round((size * 1024) / DOWNLOAD_MB_PER_SECOND / 60));
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
