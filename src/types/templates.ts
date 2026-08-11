import type { ServiceTemplatePublic, ServiceTemplateWorkflow } from '@oceanprotocol/lib';

/**
 * A workflow graph a template ships. `id`/`name`/`description`/`graph` come from ocean.js as of
 * 9.0.0-next.9; the supply → output strip the modal renders is not in that type (nor yet in the
 * node's strict schema), so it is declared here like the other node-side-only fields below.
 */
export type TemplateWorkflow = ServiceTemplateWorkflow & {
  /** One line: what the user has to bring to a run ("a portrait image"). */
  inputs?: string;
  /** One line: what a run produces ("a 5s 720p clip"). */
  output?: string;
};

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
  /**
   * What this item is for, one line. Only read when the manifest is the offer (a model pack, where
   * "which of these is the text encoder?" is a real question) — inside a bundle that also ships
   * workflows the list stays collapsed and unannotated.
   */
  role?: string;
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
  /**
   * Services only: what the bare app can do, as chips. Today these are buried in the description's
   * comma list ("txt2img, img2img, inpainting…"); declared, they render as the quiet counterpart of a
   * bundle's workflow cards. Absent, the prose alone carries the section.
   */
  capabilities?: string[];
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
export type AppTemplate = Omit<ServiceTemplatePublic, 'userConfigurableEnvVars' | 'workflows'> &
  BundleFields & {
    userConfigurableEnvVars?: AppEnvVarSpec[];
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
 * What the details modal has to describe. Three tiers, because the honest answer to "what am I
 * buying?" differs: a **recipe** (graphs it opens on), **ingredients** (weights, no graph), or an
 * **empty app**. A buyer who expects a runnable recipe and gets three checkpoints asks for a refund,
 * so `modelPack` is worth deriving even though the node's `kind` only knows service-vs-bundle.
 */
export type TemplateShape = 'recipe' | 'modelPack' | 'service';

export function templateShape(tpl: AppTemplate): TemplateShape {
  if ((tpl.workflows?.length ?? 0) > 0) {
    return 'recipe';
  }
  return (tpl.includes?.length ?? 0) > 0 ? 'modelPack' : 'service';
}

/** The catalogue word for a shape — one per tier, so the card and the modal never disagree. */
export const SHAPE_LABEL: Record<TemplateShape, string> = {
  recipe: 'Template',
  modelPack: 'Model pack',
  service: 'Service',
};

/**
 * "5 models and 1 custom node" — the collapsed manifest's own summary line. Kinds are counted
 * separately (a custom node is not a model, and calling it one is the kind of small lie that costs
 * trust), and, as everywhere else, counts only: no GB figure, no setup-time estimate.
 */
export function includesBreakdown(tpl: AppTemplate): string | null {
  const items = tpl.includes ?? [];
  if (items.length === 0) {
    return null;
  }
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const parts: string[] = [];
  const models = items.filter((i) => i.kind === 'model').length;
  const nodes = items.filter((i) => i.kind === 'customnode').length;
  const workflows = items.filter((i) => i.kind === 'workflow').length;
  const other = items.length - models - nodes - workflows;
  if (models > 0) {
    parts.push(plural(models, 'model'));
  }
  if (nodes > 0) {
    parts.push(plural(nodes, 'custom node'));
  }
  if (workflows > 0) {
    parts.push(plural(workflows, 'workflow'));
  }
  if (other > 0) {
    parts.push(plural(other, 'item'));
  }
  // "a and b", "a, b and c" — the manifest is read aloud in a sentence, not as a list.
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/**
 * Who publishes the included items ("Lightricks and Comfy-Org") — the provenance signal that has to
 * survive the manifest being collapsed. Capped at two names: past that it stops being a credential
 * and starts being a list.
 */
export function includesPublishers(tpl: AppTemplate): string | null {
  const owners = Array.from(
    new Set(
      (tpl.includes ?? [])
        .map((item) => includedRepoId(item)?.split('/')[0])
        .filter((owner): owner is string => !!owner)
    )
  );
  if (owners.length === 0) {
    return null;
  }
  if (owners.length === 1) {
    return owners[0];
  }
  const [first, second] = owners;
  return owners.length === 2 ? `${first} and ${second}` : `${first}, ${second} and others`;
}

/**
 * Show the manifest open or behind a toggle. Three annotated items answer a real question when you're
 * wiring your own graph; six near-identical checkpoint names are noise whichever way you cut them.
 */
export const INCLUDES_EXPAND_MAX = 3;

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
