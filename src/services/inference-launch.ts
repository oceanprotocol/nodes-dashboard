import { GpuSelection, ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { CHAIN_ID } from '@/constants/chains';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { buildModelDefaults } from '@/services/huggingface-service';
import { getVllmModelPreset } from '@/services/vllm-model-presets';
import { ComputeResource } from '@/types/environments';
import { CustomParam, HuggingFaceModel, InferenceEngine, ModelParameters } from '@/types/huggingface';
import { getAvailableAmount } from '@/utils/resources';
import { ComputeResourceRequest, ServiceRestartParams, ServiceStartParams } from '@oceanprotocol/lib';

/**
 * The container image + port for the "any Hugging Face model on vLLM" service. Mirrors
 * ocean-node's `docs/serviceTemplates/vllm-hf-model.json`: the OpenAI-compatible vLLM server
 * serving a single HF model, listening on port 8000.
 */
export const VLLM_IMAGE = 'vllm/vllm-openai';
export const VLLM_TAG = process.env.NEXT_PUBLIC_VLLM_TAG ?? 'v0.28.0';
export const VLLM_PORT = 8000;

/**
 * The container image + port for the llama.cpp service. Mirrors ocean-node's
 * `docs/serviceTemplates/llamacpp-phi4-cpu.json`: the OpenAI-compatible llama.cpp server serving a
 * GGUF quantization off the Hub, listening on port 8080. CPU-capable (vLLM's image is CUDA-only).
 *
 * llama.cpp publishes the CPU and CUDA builds under DIFFERENT tags — `:server` has no CUDA backend
 * compiled in, so `-ngl` on it is silently ignored ("no usable GPU found") and the model runs on CPU
 * even when the container holds GPUs. engineRuntime() picks the tag from the requested GPU layers.
 *
 * NEXT_PUBLIC_LLAMACPP_IMAGE repoints all of it at a custom build — needed for architectures the
 * upstream release doesn't carry yet (a GGUF whose arch is unknown to the binary fails to load with
 * `unknown model architecture: '<arch>'`). Set the tag vars to match your build's tags.
 */
export const LLAMACPP_IMAGE = process.env.NEXT_PUBLIC_LLAMACPP_IMAGE ?? 'ghcr.io/ggml-org/llama.cpp';
export const LLAMACPP_TAG = process.env.NEXT_PUBLIC_LLAMACPP_TAG ?? 'server';
export const LLAMACPP_TAG_CUDA = process.env.NEXT_PUBLIC_LLAMACPP_TAG_CUDA ?? 'server-cuda';
export const LLAMACPP_PORT = 8080;

/** Per-engine container image/tag/port. The launch command differs too — see buildEngineCommand. */
export const ENGINE_RUNTIME: Record<InferenceEngine, { image: string; tag: string; port: number }> = {
  vllm: { image: VLLM_IMAGE, tag: VLLM_TAG, port: VLLM_PORT },
  llamacpp: { image: LLAMACPP_IMAGE, tag: LLAMACPP_TAG, port: LLAMACPP_PORT },
};

/** True when llama.cpp is asked to offload to the GPU: N > 0 layers, or -1 = "all layers". */
function wantsGpuOffload(params: ModelParameters): boolean {
  return params.engine === 'llamacpp' && Number.isFinite(params.gpuLayers) && params.gpuLayers !== 0;
}

/**
 * The image/tag/port to launch a model with. llama.cpp GPU offload selects its CUDA image; vLLM uses
 * an explicit per-model override, then a compatibility preset, then the configured stable fallback.
 */
export function engineRuntime(modelId: string, params: ModelParameters): { image: string; tag: string; port: number } {
  const runtime = ENGINE_RUNTIME[params.engine];
  if (wantsGpuOffload(params)) {
    return { ...runtime, tag: LLAMACPP_TAG_CUDA };
  }
  if (params.engine === 'vllm') {
    const preset = getVllmModelPreset(modelId);
    return { ...runtime, tag: params.vllmTag || preset?.imageTag || runtime.tag };
  }
  return runtime;
}

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
  // Only emitted for a genuine multi-GPU shard — vLLM's default is 1, and passing it explicitly adds
  // nothing. Guarded like the numeric flags above so a NaN can't produce `--tensor-parallel-size NaN`.
  if (
    params.tensorParallelSize != null &&
    Number.isFinite(params.tensorParallelSize) &&
    params.tensorParallelSize > 1
  ) {
    cmd.push('--tensor-parallel-size', String(Math.floor(params.tensorParallelSize)));
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
  // -1 is llama.cpp's "use the default", which offloads every layer it can fit; 0 means pure CPU and
  // is the flag's own default, so it's left off the command.
  if (Number.isFinite(params.gpuLayers) && params.gpuLayers !== 0) {
    cmd.push('-ngl', String(Math.trunc(params.gpuLayers)));
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

/**
 * Normalize a custom-param key into a CLI flag: `tensor-parallel-size` → `--tensor-parallel-size`.
 * Keys already written with their dashes (`--dtype`, `-tp`) are kept verbatim, so both styles work.
 */
function toFlag(key: string): string {
  return key.startsWith('-') ? key : `--${key}`;
}

/**
 * The user's custom key/value params, as extra CLI args for the launch command. Emitted verbatim as
 * `--<key> <value>` — no type coercion — with a bare `--<key>` when the value is empty (store_true
 * style flags). Keys are trimmed (an untrimmed key would produce a `-- dtype`-ish broken flag), empty
 * ones skipped.
 *
 * Appended LAST so a custom param naming a flag the form also emits wins: both vLLM's and llama.cpp's
 * argparse keep the last occurrence of a repeated flag.
 */
function buildCustomArgs(params: ModelParameters): string[] {
  const args: string[] = [];
  for (const { key, value } of params.customParams) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      continue;
    }
    args.push(toFlag(trimmedKey));
    const trimmedValue = value.trim();
    if (trimmedValue) {
      args.push(trimmedValue);
    }
  }
  return args;
}

/** Build the launch command for whichever engine the params carry. Dispatches on `params.engine`. */
export function buildEngineCommand(model: HuggingFaceModel, params: ModelParameters): string[] {
  const cmd = params.engine === 'llamacpp' ? buildLlamaCppCommand(params) : buildVllmCommand(model, params);
  return [...cmd, ...buildCustomArgs(params)];
}

/** Detect the engine a running service uses from its dockerCmd: `-hf` is llama.cpp, else vLLM. */
export function detectEngine(cmd: string[]): InferenceEngine {
  return cmd.includes('-hf') ? 'llamacpp' : 'vllm';
}

/**
 * The model a launch command serves, or null when it names none — the cheap read of what
 * parseEngineCommand recovers in full, for callers that only need the id (a table cell, the
 * "is this a model service at all?" question).
 *
 * BOTH engines: vLLM takes `--model <hf id>`, llama.cpp `-hf <repo>[:<quant>]` (the quant is dropped —
 * the repo is the model). Reading only `--model` makes every llama.cpp service look modelless, which
 * is how one ends up image-matched to the llamacpp template and displayed as the app instead of the
 * model it serves.
 */
export function modelIdFromCommand(cmd: string[] | undefined): string | null {
  if (!cmd || cmd.length === 0) {
    return null;
  }
  const valueOf = (flag: string): string | null => {
    const idx = cmd.indexOf(flag);
    return idx >= 0 && idx + 1 < cmd.length ? cmd[idx + 1] : null;
  };
  if (detectEngine(cmd) === 'llamacpp') {
    // `-hf repo:quant` — the served model is the GGUF repo (llama.cpp has no raw-weights id).
    const hfRef = valueOf('-hf');
    return hfRef ? hfRef.split(':')[0] || null : null;
  }
  return valueOf('--model');
}

/**
 * The flags each engine's own builder emits. Anything else in a command came from a custom param —
 * that's how parseCustomArgs tells them apart. `valued` flags consume the next token, `boolean` ones
 * stand alone.
 */
const KNOWN_FLAGS: Record<InferenceEngine, { valued: string[]; boolean: string[] }> = {
  vllm: {
    valued: [
      '--model',
      '--host',
      '--port',
      '--max-model-len',
      '--gpu-memory-utilization',
      '--tensor-parallel-size',
      '--served-model-name',
      '--dtype',
      '--quantization',
      '--kv-cache-dtype',
      '--revision',
      '--tool-call-parser',
    ],
    boolean: ['--trust-remote-code', '--enforce-eager', '--enable-auto-tool-choice'],
  },
  llamacpp: {
    valued: ['-hf', '--host', '--port', '-c', '-ngl', '--alias'],
    boolean: ['--jinja'],
  },
};

/**
 * Recover the custom params from a command: every flag the engine's builder doesn't emit itself,
 * paired with the token after it (bare flags come back with an empty value). Keys keep the `--`
 * prefix they're re-emitted with, so a parse → relaunch round-trip reproduces the same command.
 *
 * A REPEATED known flag is a custom param too: buildCustomArgs appends custom params after the
 * builder's flags precisely so a custom param can override one (argparse keeps the last occurrence),
 * and only the first occurrence of each known flag came from the builder. Dropping the repeat here
 * would push the override into the typed form field — which can't hold a value outside its union
 * (`--dtype` etc.) — and the next relaunch would emit something else. Tracked per flag so the
 * override survives as what it is.
 *
 * A value starting with `-` is read as the next flag rather than a value, so a genuinely negative
 * numeric value (`--seed -1`) comes back as two bare params. Rare enough to accept over guessing.
 */
function parseCustomArgs(cmd: string[], engine: InferenceEngine): CustomParam[] {
  const known = KNOWN_FLAGS[engine];
  const custom: CustomParam[] = [];
  const seenKnown = new Set<string>();
  for (let i = 0; i < cmd.length; i++) {
    const token = cmd[i];
    if (!token.startsWith('-')) {
      continue;
    }
    const isKnown = known.valued.includes(token) || known.boolean.includes(token);
    // First occurrence of a known flag is the builder's own — not a custom param.
    if (isKnown && !seenKnown.has(token)) {
      seenKnown.add(token);
      if (known.valued.includes(token)) {
        i++;
      }
      continue;
    }
    const next = cmd[i + 1];
    const value = next && !next.startsWith('-') ? next : '';
    if (value) {
      i++;
    }
    custom.push({ key: token, value });
  }
  return custom;
}

/**
 * Reverse of buildEngineCommand: recover the model id + launch params from a running service's
 * dockerCmd (the node returns the command, not the original ModelParameters). Used by the manage
 * page to rebuild the params for a service opened without them in the URL. The engine is detected
 * from the command shape; flags absent from the command fall back to buildModelDefaults' neutral
 * values; unrecognized flags come back as customParams so an Edit relaunch doesn't silently drop them.
 */
export function parseEngineCommand(
  cmd: string[],
  runningVllmTag?: string
): { modelId: string | null; params: ModelParameters } {
  // Read the value following a flag, or undefined when the flag is absent / has no value. FIRST
  // occurrence: buildCustomArgs appends custom params after the builder's own flags, so a repeated
  // known flag is a custom override — the first occurrence is the one the typed form field emitted.
  // parseCustomArgs recovers the repeat as a customParam, which is re-emitted last and wins again
  // (argparse keeps the last occurrence), so the override survives without being counted twice.
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
        customParams: parseCustomArgs(cmd, 'llamacpp'),
        servedModelName: valueOf('--alias') || defaults.servedModelName,
        ggufRepo: ggufRepo || defaults.ggufRepo,
        ggufQuant: ggufQuant || defaults.ggufQuant,
        contextLength: Number.isFinite(contextRaw) && contextRaw > 0 ? contextRaw : null,
        // Absent flag → Number(undefined) = NaN → the default (0, CPU). -1 ("all layers") is a real
        // value and must survive the round-trip, so only non-finite falls back.
        gpuLayers: Number.isFinite(nglRaw) ? nglRaw : defaults.gpuLayers,
        jinja: has('--jinja'),
      },
    };
  }

  const modelId = valueOf('--model') ?? null;
  const defaults = buildModelDefaults(null, modelId ?? '', 'vllm') as Extract<ModelParameters, { engine: 'vllm' }>;

  const maxContextRaw = Number(valueOf('--max-model-len'));
  const gpuMemRaw = Number(valueOf('--gpu-memory-utilization'));
  const tensorParallelRaw = Number(valueOf('--tensor-parallel-size'));
  const dtype = valueOf('--dtype');
  const quantization = valueOf('--quantization');
  const kvCacheDtype = valueOf('--kv-cache-dtype');

  return {
    modelId,
    params: {
      ...defaults,
      vllmTag: runningVllmTag ?? defaults.vllmTag,
      customParams: parseCustomArgs(cmd, 'vllm'),
      servedModelName: valueOf('--served-model-name') || defaults.servedModelName,
      // Flag absent (or garbage) → null: the service launched without a pinned length, so vLLM
      // derived it. Keep that as null rather than inventing a number.
      maxContext: Number.isFinite(maxContextRaw) && maxContextRaw > 0 ? maxContextRaw : null,
      gpuMemoryUtilization: Number.isFinite(gpuMemRaw) && gpuMemRaw > 0 ? gpuMemRaw : defaults.gpuMemoryUtilization,
      // Flag absent → single GPU (vLLM's default), which we represent as null so it isn't re-emitted.
      tensorParallelSize: Number.isFinite(tensorParallelRaw) && tensorParallelRaw > 1 ? tensorParallelRaw : null,
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
 * Container env vars, sent as plaintext userData (ocean.js ECIES-encrypts before transit). Only
 * HF_TOKEN, which unlocks gated/private repos — the user's custom key/value params are launch flags
 * on the command (see buildCustomArgs), not env vars.
 */
export function buildUserData(hfToken: string): Record<string, string> {
  return hfToken ? { HF_TOKEN: hfToken } : {};
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
export function buildGpuRequests(resources: ComputeResource[], gpuSelection?: GpuSelection): ComputeResourceRequest[] {
  const gpus = resources.filter((r) => isGpuId(r.id, r.type));
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
export function resourceId(resources: ComputeResource[], type: 'cpu' | 'ram' | 'disk'): string {
  return resources.find((r) => r.type === type || r.id === type)?.id ?? type;
}

/** Same GPU test buildGpuRequests uses, so parse and build agree on which ids are GPUs. */
function isGpuId(id: string, type?: string): boolean {
  return type === 'gpu' || id.toLowerCase().includes('gpu');
}

/** What a running service actually holds, in the shapes the flow already speaks. */
export type BookedServiceResources = {
  /** Per-GPU-type unit counts, keyed the way useInferenceAllocation merges types (by description). */
  gpuSelection: GpuSelection;
  /** The booked CPU/RAM/disk as `exact` sizing — shown/priced verbatim, never re-clamped. */
  sizing: ResourceSizing;
};

/**
 * Reverse of the `resources` array buildInferenceStartParams sends: recover what a RUNNING service
 * booked from the node's own job record (`ServiceJob.resources`, `[{ id, amount }]`) — the
 * authoritative figures, as opposed to re-deriving a proportional slice that the service may not
 * match (and which a service opened from the services table has no `gpus`/`res` params to restore).
 *
 * Returns null when the job carries no usable resource record, so callers can fall back to whatever
 * the URL-hydrated selection holds.
 */
export function parseServiceResources(
  envResources: ComputeResource[],
  jobResources: { id?: string; amount?: number }[] | undefined
): BookedServiceResources | null {
  const booked = new Map<string, number>();
  (jobResources ?? []).forEach((entry) => {
    const amount = Number(entry?.amount);
    if (typeof entry?.id !== 'string' || !Number.isFinite(amount)) {
      return;
    }
    // Summed per id: the node may record a resource in more than one entry (as buildGpuRequests can
    // emit for a pooled id).
    booked.set(entry.id, (booked.get(entry.id) ?? 0) + amount);
  });
  if (booked.size === 0) {
    return null;
  }

  // The env's own id for the type, with the bare type name as a fallback — a record written against a
  // differently-named id than the env currently advertises still resolves.
  const amountOf = (type: 'cpu' | 'ram' | 'disk'): number =>
    booked.get(resourceId(envResources, type)) ?? booked.get(type) ?? 0;

  const gpuSelection: GpuSelection = {};
  // Seed EVERY GPU type the env advertises, including types this service booked none of: a missing key
  // makes useInferenceAllocation fall back to its whole-env default for that type, which would report
  // an untouched type as fully selected.
  const envGpus = envResources.filter((r) => isGpuId(r.id, r.type));
  envGpus.forEach((gpu) => {
    const key = gpu.description || 'GPU';
    gpuSelection[key] = (gpuSelection[key] ?? 0) + (booked.get(gpu.id) ?? 0);
  });
  // A booked GPU id the env no longer advertises can't be mapped to a type — attribute it to the
  // description-less fallback key (the same one the merge uses) so its units aren't silently dropped.
  const envGpuIds = new Set(envGpus.map((r) => r.id));
  booked.forEach((amount, id) => {
    if (isGpuId(id) && !envGpuIds.has(id)) {
      gpuSelection.GPU = (gpuSelection.GPU ?? 0) + amount;
    }
  });

  return {
    gpuSelection,
    sizing: { mode: 'exact', cpu: amountOf('cpu'), ram: amountOf('ram'), disk: amountOf('disk') },
  };
}

/**
 * Build the container spec for an Edit relaunch (serviceRestart). Sending image/tag puts the node in
 * RESPEC mode, where the container is rebuilt from this spec alone — so `image` is mandatory (a
 * command-only spec is rejected with 'Restarting with new parameters requires "image"') and both are
 * taken from the NEW params' engine, which is what makes switching engine (vLLM ↔ llama.cpp) work in
 * place. Ports/resources/duration are NOT part of a restart: the node keeps the service's existing ones.
 */
export function buildInferenceRestartSpec({
  model,
  params,
  hfToken,
}: {
  model: HuggingFaceModel;
  params: ModelParameters;
  hfToken: string;
}): ServiceRestartParams {
  const runtime = engineRuntime(model.id, params);
  return {
    image: runtime.image,
    tag: runtime.tag,
    dockerCmd: buildEngineCommand(model, params),
    userData: buildUserData(hfToken),
  };
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
  const runtime = engineRuntime(model.id, params);

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
    userData: buildUserData(hfToken),
    resources,
    duration: durationSeconds,
    payment: { chainId: CHAIN_ID, token: tokenAddress },
  };
}
