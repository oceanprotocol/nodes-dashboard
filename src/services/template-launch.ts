import { GpuSelection, ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { CHAIN_ID } from '@/constants/chains';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { buildGpuRequests, resourceId } from '@/services/inference-launch';
import { AppTemplate, TemplateWorkflow } from '@/types/templates';
import { ComputeResourceRequest, ServiceRestartParams, ServiceStartParams } from '@oceanprotocol/lib';

/** Whole CPU/RAM/disk allocation for the service (from useInferenceAllocation). */
type Allocation = {
  cpu: number;
  ram: number;
  disk: number;
};

/** gzip + base64, so a ~130 KB workflow graph rides in a container env var as ~25 KB. */
export async function gzipBase64(value: string): Promise<string> {
  // The DOM lib's CompressionStream/pipeThrough generics disagree on ArrayBuffer vs ArrayBufferLike
  // in this TS version — a type-only mismatch (Blob.stream().pipeThrough(new CompressionStream(...))
  // is standard, well-supported browser API usage at runtime).
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream('gzip') as unknown as ReadableWritablePair);
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on large graphs.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * A template needs the persistent-storage bucket picker when it ships a workflow (it loads a large
 * model graph the bucket caches). Also gates whether a fresh (non-edit) launch must stop at the
 * config step instead of its usual skip-straight-to-payment: skipping would make the picker — and the
 * bucket-mount cost warning — unreachable before the escrow claim. Accepts a possibly-absent template
 * so callers don't need to guard first.
 */
export function templateNeedsBucketPicker(template: AppTemplate | null | undefined): boolean {
  if (!template) {
    return false;
  }
  return (template.workflows?.length ?? 0) > 0;
}

const COMFY_WORKFLOW_ID_KEY = 'COMFY_WORKFLOW_ID';
const COMFY_WORKFLOW_KEY = 'COMFY_WORKFLOW';

/**
 * Env var keys set automatically from the template's single workflow (by withWorkflowUserData) — the
 * config page's free-text env inputs must exclude these, since whatever's typed there is silently
 * overwritten at launch. A single constant so the writer and the filter can't drift apart.
 */
export const WORKFLOW_ENV_VAR_KEYS: readonly string[] = [COMFY_WORKFLOW_ID_KEY, COMFY_WORKFLOW_KEY];

/**
 * Add the template's workflow userData — mutates and returns `userData`. Installs every workflow
 * the template ships (not just the one launched with) as gzip+base64 of `{ "<id>": <graph>, ... }`,
 * so the container's Workflows sidebar has all of them. COMFY_WORKFLOW_ID stays the FIRST
 * workflow's id regardless — the bootstrap uses it for the pack name and it's what Open deep-links
 * to. A workflow with no graph is skipped (logged); skipped entirely (both keys) when none of the
 * template's workflows has one — a node that served metadata without a body would otherwise ship
 * `JSON.stringify(undefined)` → the literal string "undefined" as installed workflow content.
 */
async function withWorkflowUserData(
  userData: Record<string, string>,
  workflows?: TemplateWorkflow[]
): Promise<Record<string, string>> {
  if (!workflows || workflows.length === 0) {
    return userData;
  }
  const graphs: Record<string, unknown> = {};
  for (const workflow of workflows) {
    if (workflow.graph == null) {
      console.error(`Workflow "${workflow.id}" has no graph — skipping its userData.`);
    } else {
      graphs[workflow.id] = workflow.graph;
    }
  }
  if (Object.keys(graphs).length > 0) {
    userData[COMFY_WORKFLOW_ID_KEY] = workflows[0].id;
    userData[COMFY_WORKFLOW_KEY] = await gzipBase64(JSON.stringify(graphs));
  }
  return userData;
}

/**
 * Container env vars for a template launch, sent as plaintext userData (ocean.js ECIES-encrypts before
 * transit) from the user-supplied values for the template's `userConfigurableEnvVars` — only keys the
 * user actually filled are emitted. Operator-fixed launch config is not env: it rides in the template's
 * `command`, which the node forwards to the container verbatim (dockerCmd), so nothing to merge here.
 */
export function buildTemplateUserData(template: AppTemplate, envValues: Record<string, string>): Record<string, string> {
  const userData: Record<string, string> = {};
  for (const spec of template.userConfigurableEnvVars ?? []) {
    const value = envValues[spec.key];
    if (value) {
      userData[spec.key] = value;
    }
  }
  return userData;
}

/**
 * Build the ServiceStartParams to launch an app template on the chosen environment. Mirrors
 * buildInferenceStartParams, but sources image/tag/ports/command from the template instead of the
 * engine map, and userData from the template's env vars instead of vLLM/llama.cpp params. The env's
 * cpu/ram/disk/gpu request comes from the resolved allocation + gpu selection (same as inference).
 */
export async function buildTemplateStartParams({
  template,
  selectedEnv,
  gpuSelection,
  allocation,
  durationSeconds,
  tokenAddress,
  envValues,
  bucketId,
}: {
  template: AppTemplate;
  selectedEnv: SelectedInferenceEnv;
  /** Resolved per-type GPU units to request — pass the allocation hook's selectedByKey. */
  gpuSelection?: GpuSelection;
  allocation: Allocation;
  durationSeconds: number;
  tokenAddress: string;
  envValues: Record<string, string>;
  /**
   * Unused: every workflow the template ships now installs regardless of which one is picked (see
   * withWorkflowUserData) — kept in the type only so existing callers that still pass the picked
   * workflow (Templates flow) don't need an unrelated edit.
   */
  workflow?: TemplateWorkflow;
  /** Persistent-storage bucket id to mount at /data/outputs — picked on the config step. */
  bucketId?: string;
}): Promise<ServiceStartParams> {
  const envResources = selectedEnv.environment.resources ?? [];

  // Exactly one image reference: tag or checksum (dockerfile builds are gated node-side and not offered here).
  const imageRef = template.tag ? { tag: template.tag } : template.checksum ? { checksum: template.checksum } : {};

  const resources: ComputeResourceRequest[] = [
    { id: resourceId(envResources, 'cpu'), amount: allocation.cpu },
    { id: resourceId(envResources, 'ram'), amount: allocation.ram },
    { id: resourceId(envResources, 'disk'), amount: allocation.disk },
    ...buildGpuRequests(envResources, gpuSelection ?? selectedEnv.gpuSelection),
  ];

  const userData = await withWorkflowUserData(buildTemplateUserData(template, envValues), template.workflows);

  return {
    environment: selectedEnv.environment.id,
    image: template.image,
    ...imageRef,
    exposedPorts: template.exposedPorts,
    ...(template.command && template.command.length > 0 ? { dockerCmd: template.command } : {}),
    ...(template.entrypoint && template.entrypoint.length > 0 ? { dockerEntrypoint: template.entrypoint } : {}),
    userData,
    resources,
    duration: durationSeconds,
    payment: { chainId: CHAIN_ID, token: tokenAddress },
    ...(bucketId ? { outputBucketId: bucketId } : {}),
  };
}

/**
 * Build the ServiceRestartParams to relaunch a running service ONTO a (possibly different) template,
 * in place. As of next.6 serviceRestart can pull a new image, so this carries the target template's
 * image/tag/checksum + launch command + configured env vars — letting an Edit switch apps without a
 * stop+start (serviceId, host port and paid window are preserved). Unlike buildTemplateStartParams
 * there is no environment/resources/ports/duration/payment: the node reuses the running service's
 * allocation and never re-allocates ports on restart (a template needing different ports/hardware
 * needs a fresh start instead).
 */
export async function buildTemplateRestartParams(
  template: AppTemplate,
  envValues: Record<string, string>,
  /**
   * Unused: every workflow the template ships now installs regardless of which one is picked (see
   * withWorkflowUserData) — kept in the signature only so existing callers that still pass the
   * picked workflow (Templates flow) don't need an unrelated edit.
   */
  workflow?: TemplateWorkflow
): Promise<ServiceRestartParams> {
  // Exactly one image reference: tag or checksum (dockerfile builds are gated node-side and not offered here).
  const imageRef = template.tag ? { tag: template.tag } : template.checksum ? { checksum: template.checksum } : {};
  const userData = await withWorkflowUserData(buildTemplateUserData(template, envValues), template.workflows);
  return {
    image: template.image,
    ...imageRef,
    ...(template.command && template.command.length > 0 ? { dockerCmd: template.command } : {}),
    ...(template.entrypoint && template.entrypoint.length > 0 ? { dockerEntrypoint: template.entrypoint } : {}),
    userData,
  };
}

/**
 * Pin the template's recommended CPU/RAM/disk so the payment step books that sized allocation (the same
 * `pinned` sizing quick start uses), floored at the template's required per-resource min — the effective
 * lower bound is max(envMin, templateMin), so a constraint ceiling can't trim the booked amount below
 * what the app needs. Prefer `recommendedResources`, else `requiredResources`; per resource use
 * `recommended`, falling back to `min`. Undefined when any of cpu/ram/disk is absent — then the launch
 * falls back to the GPU-fraction slice rather than silently booking the environment's bare minimum.
 * GPU is handled separately by the gpu selection. Clamped to the env's real limits downstream.
 */
export function templatePinnedSizing(template: AppTemplate): ResourceSizing | undefined {
  const reqs = template.recommendedResources ?? template.requiredResources;
  if (!reqs) {
    return undefined;
  }
  const amount = (id: string): number | undefined => {
    const entry = reqs.find((r) => r.id === id);
    return entry ? (entry.recommended ?? entry.min) : undefined;
  };
  const cpu = amount('cpu');
  const ram = amount('ram');
  const disk = amount('disk');
  if (cpu == null || ram == null || disk == null) {
    return undefined;
  }
  const min = (id: string): number => template.requiredResources?.find((r) => r.id === id)?.min ?? 0;
  return { mode: 'pinned', cpu, ram, disk, floor: { cpu: min('cpu'), ram: min('ram'), disk: min('disk') } };
}

/** The port serving the template's primary web UI (first exposed port) — for the "Open" link. */
export function templatePrimaryPort(template: AppTemplate): number | undefined {
  return template.exposedPorts?.[0];
}

/**
 * The running app's URL with the installed workflow deep-linked. The bootstrap installs the graph at
 * `custom_nodes/<workflow.id>/example_workflows/<workflow.id>.json`, so the id is both halves of the
 * link. `source` must be that module name — ComfyUI resolves `source=all` only against its own core
 * templates and never finds a custom-node pack, failing silently.
 */
export function templateOpenUrl(baseUrl: string, workflowId: string): string {
  const id = encodeURIComponent(workflowId);
  return `${baseUrl}/?template=${id}&source=${id}`;
}
