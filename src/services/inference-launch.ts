import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { CHAIN_ID } from '@/constants/chains';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { buildModelDefaults } from '@/services/huggingface-service';
import { ComputeResource } from '@/types/environments';
import { HuggingFaceModel, InferenceEngine, ModelParameters } from '@/types/huggingface';
import { getAvailableAmount } from '@/utils/resources';
import { ComputeResourceRequest, ServiceStartParams } from '@oceanprotocol/lib';

/**
 * The container image + port for the "any Hugging Face model on vLLM" service. Mirrors
 * ocean-node's `docs/serviceTemplates/vllm-hf-model.json`: the OpenAI-compatible vLLM server
 * serving a single HF model, listening on port 8000.
 */
export const VLLM_IMAGE = 'vllm/vllm-openai';
export const VLLM_TAG = process.env.NEXT_PUBLIC_VLLM_TAG ?? 'latest';
export const VLLM_PORT = 8000;

/**
 * The container image + port for the llama.cpp service. Mirrors ocean-node's
 * `docs/serviceTemplates/llamacpp-phi4-cpu.json`: the OpenAI-compatible llama.cpp server serving a
 * GGUF quantization off the Hub, listening on port 8080. CPU-capable (vLLM's image is CUDA-only).
 */
export const LLAMACPP_IMAGE = 'ghcr.io/ggml-org/llama.cpp';
export const LLAMACPP_TAG = process.env.NEXT_PUBLIC_LLAMACPP_TAG ?? 'server';
export const LLAMACPP_PORT = 8080;

/** Per-engine container image/tag/port. The launch command differs too — see buildEngineCommand. */
export const ENGINE_RUNTIME: Record<InferenceEngine, { image: string; tag: string; port: number }> = {
  vllm: { image: VLLM_IMAGE, tag: VLLM_TAG, port: VLLM_PORT },
  llamacpp: { image: LLAMACPP_IMAGE, tag: LLAMACPP_TAG, port: LLAMACPP_PORT },
};

/** The container port an engine's OpenAI-compatible server listens on (for endpoint lookup on manage). */
export function enginePort(engine: InferenceEngine): number {
  return ENGINE_RUNTIME[engine].port;
}

/** Whole CPU/RAM/disk allocation for the service (from useInferenceAllocation). */
type Allocation = {
  cpu: number;
  ram: number;
  disk: number;
};

/**
 * Normalize a node's multiaddrs (or bare peer id) into the nodeUri ocean.js commands expect.
 *
 * A node advertises many addrs — bare `/tcp` (no WebSocket), `/dns4/.../tcp`, `/ws`, `/wss`,
 * `libp2p.direct` relay. The browser libp2p transport can only dial WebSocket addrs; handing it the
 * bare-TCP ones makes every dial fail (the "WebSocket connection … failed" console spam) and the
 * command hangs. Keep only `ws`/`wss` addrs, and put the `libp2p.direct` secure-relay addrs first —
 * those traverse NAT reliably from a browser (same addr shape as the hardcoded default node).
 */
export function toNodeUri(nodeInfo: { multiaddrs?: string[]; id: string }): string[] | string {
  const dialable = (nodeInfo.multiaddrs ?? []).filter((a) => a.includes('/ws') || a.includes('/wss'));
  const ranked = [...dialable].sort((a, b) => {
    const score = (addr: string) => (addr.includes('libp2p.direct') ? 0 : 1);
    return score(a) - score(b);
  });
  const addrs = ranked.map((a) => (a.includes('/p2p/') ? a : `${a}/p2p/${nodeInfo.id}`));
  return addrs.length > 0 ? addrs : nodeInfo.id;
}

/**
 * Turn vLLM launch parameters into the server command (Docker CMD, exec-form). Every arg is a
 * separate array element (exec form — no shell). `--max-model-len` / `--gpu-memory-utilization` are
 * only emitted when they hold a valid value: a NaN/0/empty value stringifies to a garbage flag
 * (`--max-model-len NaN`) that makes vLLM exit 1 at startup, so we drop it and let vLLM derive the
 * default from the model config instead.
 */
function buildVllmCommand(model: HuggingFaceModel, params: Extract<ModelParameters, { engine: 'vllm' }>): string[] {
  const cmd = ['--model', model.id, '--host', '0.0.0.0', '--port', String(VLLM_PORT)];

  if (params.maxContext != null && Number.isFinite(params.maxContext) && params.maxContext > 0) {
    cmd.push('--max-model-len', String(Math.floor(params.maxContext)));
  }
  if (Number.isFinite(params.gpuMemoryUtilization) && params.gpuMemoryUtilization > 0) {
    cmd.push('--gpu-memory-utilization', String(params.gpuMemoryUtilization));
  }

  if (params.servedModelName) {
    cmd.push('--served-model-name', params.servedModelName);
  }
  if (params.dtype !== 'auto') {
    cmd.push('--dtype', params.dtype);
  }
  if (params.quantization !== 'none') {
    cmd.push('--quantization', params.quantization);
  }
  if (params.kvCacheDtype !== 'auto') {
    cmd.push('--kv-cache-dtype', params.kvCacheDtype);
  }
  if (params.revision) {
    cmd.push('--revision', params.revision);
  }
  if (params.trustRemoteCode) {
    cmd.push('--trust-remote-code');
  }
  if (params.enforceEager) {
    cmd.push('--enforce-eager');
  }
  if (params.toolCalling && params.toolCallParser) {
    cmd.push('--enable-auto-tool-choice', '--tool-call-parser', params.toolCallParser);
  }

  return cmd;
}

/**
 * Turn llama.cpp launch parameters into the server command (Docker CMD, exec-form). llama.cpp pulls
 * a GGUF from the Hub via `-hf <repo>:<quant>`, so the served model is the repo+quant, not the HF
 * model id. `-c` / `-ngl` are only emitted when valid so a NaN can't crash the server at startup.
 */
function buildLlamaCppCommand(params: Extract<ModelParameters, { engine: 'llamacpp' }>): string[] {
  // `-hf repo:quant` — the quant tag is appended only when set (bare repo lets llama.cpp pick).
  const hfRef = params.ggufQuant ? `${params.ggufRepo}:${params.ggufQuant}` : params.ggufRepo;
  const cmd = ['-hf', hfRef, '--host', '0.0.0.0', '--port', String(LLAMACPP_PORT)];

  if (params.contextLength != null && Number.isFinite(params.contextLength) && params.contextLength > 0) {
    cmd.push('-c', String(Math.floor(params.contextLength)));
  }
  if (Number.isFinite(params.gpuLayers) && params.gpuLayers > 0) {
    cmd.push('-ngl', String(Math.floor(params.gpuLayers)));
  }
  if (params.servedModelName) {
    cmd.push('--alias', params.servedModelName);
  }
  if (params.jinja) {
    cmd.push('--jinja');
  }
  // Flash attention is left to llama.cpp's own auto-detection (the server default) — not exposed.

  return cmd;
}

/** Build the launch command for whichever engine the params carry. Dispatches on `params.engine`. */
export function buildEngineCommand(model: HuggingFaceModel, params: ModelParameters): string[] {
  return params.engine === 'llamacpp' ? buildLlamaCppCommand(params) : buildVllmCommand(model, params);
}

/** Detect the engine a running service uses from its dockerCmd: `-hf` is llama.cpp, else vLLM. */
export function detectEngine(cmd: string[]): InferenceEngine {
  return cmd.includes('-hf') ? 'llamacpp' : 'vllm';
}

/**
 * Reverse of buildEngineCommand: recover the model id + launch params from a running service's
 * dockerCmd (the node returns the command, not the original ModelParameters). Used by the manage
 * page to rebuild the params for a service opened without them in the URL. The engine is detected
 * from the command shape; flags absent from the command fall back to buildModelDefaults' neutral
 * values; customParams can't be recovered from the command (they live in the encrypted userData), so
 * they come back empty.
 */
export function parseEngineCommand(cmd: string[]): { modelId: string | null; params: ModelParameters } {
  // Read the value following a flag, or undefined when the flag is absent / has no value.
  const valueOf = (flag: string): string | undefined => {
    const idx = cmd.indexOf(flag);
    return idx >= 0 && idx + 1 < cmd.length ? cmd[idx + 1] : undefined;
  };
  const has = (flag: string): boolean => cmd.includes(flag);

  if (detectEngine(cmd) === 'llamacpp') {
    // `-hf repo:quant` — the model id we surface is the GGUF repo (llama.cpp has no raw-weights id).
    const hfRef = valueOf('-hf') ?? '';
    const [ggufRepo, ggufQuant] = hfRef.includes(':') ? hfRef.split(':') : [hfRef, ''];
    const defaults = buildModelDefaults(null, ggufRepo, 'llamacpp') as Extract<ModelParameters, { engine: 'llamacpp' }>;
    const contextRaw = Number(valueOf('-c'));
    const nglRaw = Number(valueOf('-ngl'));
    return {
      modelId: ggufRepo || null,
      params: {
        ...defaults,
        servedModelName: valueOf('--alias') || defaults.servedModelName,
        ggufRepo: ggufRepo || defaults.ggufRepo,
        ggufQuant: ggufQuant || defaults.ggufQuant,
        contextLength: Number.isFinite(contextRaw) && contextRaw > 0 ? contextRaw : null,
        gpuLayers: Number.isFinite(nglRaw) && nglRaw > 0 ? nglRaw : defaults.gpuLayers,
        jinja: has('--jinja'),
      },
    };
  }

  const modelId = valueOf('--model') ?? null;
  const defaults = buildModelDefaults(null, modelId ?? '', 'vllm') as Extract<ModelParameters, { engine: 'vllm' }>;

  const maxContextRaw = Number(valueOf('--max-model-len'));
  const gpuMemRaw = Number(valueOf('--gpu-memory-utilization'));
  const dtype = valueOf('--dtype');
  const quantization = valueOf('--quantization');
  const kvCacheDtype = valueOf('--kv-cache-dtype');

  return {
    modelId,
    params: {
      ...defaults,
      servedModelName: valueOf('--served-model-name') || defaults.servedModelName,
      // Flag absent (or garbage) → null: the service launched without a pinned length, so vLLM
      // derived it. Keep that as null rather than inventing a number.
      maxContext: Number.isFinite(maxContextRaw) && maxContextRaw > 0 ? maxContextRaw : null,
      gpuMemoryUtilization: Number.isFinite(gpuMemRaw) && gpuMemRaw > 0 ? gpuMemRaw : defaults.gpuMemoryUtilization,
      dtype: (dtype as typeof defaults.dtype) ?? defaults.dtype,
      quantization: (quantization as typeof defaults.quantization) ?? defaults.quantization,
      kvCacheDtype: (kvCacheDtype as typeof defaults.kvCacheDtype) ?? defaults.kvCacheDtype,
      revision: valueOf('--revision') ?? defaults.revision,
      trustRemoteCode: has('--trust-remote-code'),
      enforceEager: has('--enforce-eager'),
      toolCalling: has('--enable-auto-tool-choice'),
      toolCallParser: (valueOf('--tool-call-parser') as typeof defaults.toolCallParser) ?? defaults.toolCallParser,
    },
  };
}

/**
 * Container env vars, sent as plaintext userData (ocean.js ECIES-encrypts before transit).
 * HF_TOKEN unlocks gated/private repos; the user's custom key/value params are passed through as-is.
 */
export function buildUserData(params: ModelParameters, hfToken: string): Record<string, string> {
  const userData: Record<string, string> = {};
  for (const { key, value } of params.customParams) {
    // Trim the key — the form validates uniqueness/non-emptiness on the trimmed key, so a stray
    // leading/trailing space would otherwise reach the container as a distinct env-var name (e.g.
    // "HF_TOKEN ") that silently never sets the intended variable.
    const trimmedKey = key.trim();
    if (trimmedKey) {
      userData[trimmedKey] = value;
    }
  }
  // Assign the dedicated HF token LAST so a stray custom param keyed HF_TOKEN can't shadow the
  // real credential and lock the launch out of gated/private repos.
  if (hfToken) {
    userData.HF_TOKEN = hfToken;
  }
  return userData;
}

/**
 * Expand the per-GPU-type unit selection into individual GPU resource-id requests. `gpuSelection`
 * is keyed by GPU description (as merged in useInferenceAllocation); each entry asks for N units.
 * Omit / empty selection means "use every free GPU unit" (whole-environment allocation).
 *
 * Units are counted the same way the allocation hook prices them: a resource id contributes
 * `getAvailableAmount(id)` (max − inUse) UNITS, which may be >1 for a pooled id. We draw the
 * requested units from the free ids of a type, taking up to each id's free amount before moving to
 * the next id — so a single pooled id with 4 free units satisfies a 4-unit pick as `{id, amount:4}`,
 * matching what was priced/escrowed. Requesting per-id blindly (amount:1 each) would disagree with
 * the pricing whenever an id advertises more than one free unit.
 *
 * Throws if the selection can't be satisfied from the free pool — an unknown description, or more
 * units requested than are free for a type. Silently truncating would launch (and provision) FEWER
 * GPUs than the user selected and is paying escrow for; failing loudly surfaces the real shortfall
 * (e.g. a restored/booked pick whose units were taken by another tenant since) instead.
 */
function buildGpuRequests(resources: ComputeResource[], gpuSelection?: GpuSelection): ComputeResourceRequest[] {
  const gpus = resources.filter((r) => r.type === 'gpu' || r.id.toLowerCase().includes('gpu'));
  if (gpus.length === 0) {
    return [];
  }

  const freeGpus = gpus.filter((gpu) => getAvailableAmount(gpu) > 0);

  // No explicit selection → request every free GPU unit across all ids.
  if (!gpuSelection || Object.keys(gpuSelection).length === 0) {
    return freeGpus.map((gpu) => ({ id: gpu.id, amount: getAvailableAmount(gpu) }));
  }

  const requests: ComputeResourceRequest[] = [];
  for (const [key, units] of Object.entries(gpuSelection)) {
    if (units <= 0) {
      continue;
    }
    const ofType = freeGpus.filter((gpu) => (gpu.description || 'GPU') === key);
    const freeUnits = ofType.reduce((sum, gpu) => sum + getAvailableAmount(gpu), 0);
    if (freeUnits < units) {
      throw new Error(
        `Cannot allocate ${units} × "${key}" GPU${units > 1 ? 's' : ''}: only ${freeUnits} free right now. Try reducing your selection.`
      );
    }
    // Draw `units` from the free pool of this type, taking up to each id's free amount in turn.
    let remaining = units;
    for (const gpu of ofType) {
      if (remaining <= 0) {
        break;
      }
      const take = Math.min(remaining, getAvailableAmount(gpu));
      requests.push({ id: gpu.id, amount: take });
      remaining -= take;
    }
  }
  return requests;
}

/** Look up the resource id for a base type (cpu/ram/disk), falling back to the type name. */
function resourceId(resources: ComputeResource[], type: 'cpu' | 'ram' | 'disk'): string {
  return resources.find((r) => r.type === type || r.id === type)?.id ?? type;
}

/**
 * Build the ServiceStartParams to launch a single Hugging Face model on vLLM. Maps the selected
 * model + its launch params + the chosen environment/allocation into the node's service-start
 * request. `userData` is plaintext here — ocean.js encrypts it.
 */
export function buildInferenceStartParams({
  model,
  params,
  selectedEnv,
  gpuSelection,
  allocation,
  durationSeconds,
  tokenAddress,
  hfToken,
}: {
  model: HuggingFaceModel;
  params: ModelParameters;
  selectedEnv: SelectedInferenceEnv;
  /**
   * Per-type unit counts to actually request — pass the allocation hook's RESOLVED selectedByKey so
   * the launch requests exactly what was priced/escrowed. Falls back to selectedEnv.gpuSelection,
   * but that can be `{}` (whole-env hydrate) which buildGpuRequests reads as "every free GPU".
   */
  gpuSelection?: GpuSelection;
  allocation: Allocation;
  durationSeconds: number;
  tokenAddress: string;
  hfToken: string;
}): ServiceStartParams {
  const envResources = selectedEnv.environment.resources ?? [];
  const runtime = ENGINE_RUNTIME[params.engine];

  const resources: ComputeResourceRequest[] = [
    { id: resourceId(envResources, 'cpu'), amount: allocation.cpu },
    { id: resourceId(envResources, 'ram'), amount: allocation.ram },
    { id: resourceId(envResources, 'disk'), amount: allocation.disk },
    ...buildGpuRequests(envResources, gpuSelection ?? selectedEnv.gpuSelection),
  ];

  return {
    environment: selectedEnv.environment.id,
    image: runtime.image,
    tag: runtime.tag,
    exposedPorts: [runtime.port],
    dockerCmd: buildEngineCommand(model, params),
    userData: buildUserData(params, hfToken),
    resources,
    duration: durationSeconds,
    payment: { chainId: CHAIN_ID, token: tokenAddress },
  };
}
