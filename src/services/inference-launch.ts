import { GpuSelection, ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { CHAIN_ID } from '@/constants/chains';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { comfyModelFilesEnv, getComfyPresets } from '@/data/comfy-model-presets';
import { buildModelDefaults } from '@/services/huggingface-service';
import { getModelCompatibility } from '@/services/model-compatibility';
import { buildServiceMetadata, ServiceAppType } from '@/services/service-metadata';
import { ComputeResource } from '@/types/environments';
import {
  ComfyUIParameters,
  CustomParam,
  HuggingFaceModel,
  InferenceEngine,
  ModelParameters,
} from '@/types/huggingface';
import { AppTemplate } from '@/types/templates';
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

/** ComfyUI's web UI and graph API port, and the id of the node template that launches it. */
export const COMFYUI_PORT = 8188;
export const COMFY_WORKER_TEMPLATE_ID = 'comfyui-worker';

/**
 * The container port each engine's server listens on. vLLM and llama.cpp serve an
 * OpenAI-compatible API; ComfyUI serves its own graph API and web UI on 8188.
 */
export const ENGINE_PORT: Record<InferenceEngine, number> = {
  vllm: VLLM_PORT,
  llamacpp: LLAMACPP_PORT,
  comfyui: COMFYUI_PORT,
};

/**
 * Container image + tag for the engines the dashboard launches directly. ComfyUI is absent on
 * purpose: its bootstrap is a template `commandFile`, resolved node-side (see
 * ocean-node/src/components/core/service/templateLoader.ts), so image, tag and command all come
 * from the node's comfyui-worker template rather than from here.
 */
export const ENGINE_IMAGE: Record<'vllm' | 'llamacpp', { image: string; tag: string }> = {
  vllm: { image: VLLM_IMAGE, tag: VLLM_TAG },
  llamacpp: { image: LLAMACPP_IMAGE, tag: LLAMACPP_TAG },
};

/** True when llama.cpp is asked to offload to the GPU: N > 0 layers, or -1 = "all layers". */
function wantsGpuOffload(params: ModelParameters): boolean {
  return params.engine === 'llamacpp' && Number.isFinite(params.gpuLayers) && params.gpuLayers !== 0;
}

/**
 * The image/tag to launch a model with. llama.cpp GPU offload selects its CUDA image; vLLM uses the
 * tag resolved by the configuration flow, then the configured stable fallback. ComfyUI has no answer
 * here — its caller reads the comfyui-worker template instead.
 */
export function engineRuntime(params: ModelParameters): { image: string; tag: string; port: number } | null {
  if (params.engine === 'comfyui') {
    return null;
  }
  const runtime = { ...ENGINE_IMAGE[params.engine], port: ENGINE_PORT[params.engine] };
  if (wantsGpuOffload(params)) {
    return { ...runtime, tag: LLAMACPP_TAG_CUDA };
  }
  if (params.engine === 'vllm') {
    return { ...runtime, tag: params.vllmTag || runtime.tag };
  }
  return runtime;
}

/** The container port an engine serves on (for endpoint lookup on manage). */
export function enginePort(engine: InferenceEngine): number {
  return ENGINE_PORT[engine];
}

/** Whole CPU/RAM/disk allocation for the service (from useInferenceAllocation). */
export type Allocation = {
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
  if (params.engine === 'comfyui') {
    // The comfyui-worker template carries the command (its bootstrap is a node-side commandFile).
    // Reaching here means a caller built a launch without reading the template — fail loudly, since
    // the silent alternative is a container that starts with no weights after escrow is claimed.
    throw new Error('ComfyUI launches take their command from the comfyui-worker template');
  }
  const cmd = params.engine === 'llamacpp' ? buildLlamaCppCommand(params) : buildVllmCommand(model, params);
  return [...cmd, ...buildCustomArgs(params)];
}

/**
 * The engine a running service uses, from its dockerCmd. ComfyUI first: it has neither `-hf` nor
 * `--model`, so the old two-way test would call every ComfyUI service vLLM and then look for its
 * endpoint on port 8000.
 */
export function detectEngine(cmd: string[]): InferenceEngine {
  if (cmd.some((arg) => arg.includes('--enable-cors-header'))) {
    return 'comfyui';
  }
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
 *
 * ComfyUI is absent for the same reason it is absent from ENGINE_IMAGE: no flag here is ours, the
 * whole command is the comfyui-worker template's, so there is nothing for a custom param to be told
 * apart FROM. Custom launch flags are a text-engine concept, hence the narrowed key type.
 */
const KNOWN_FLAGS: Record<'vllm' | 'llamacpp', { valued: string[]; boolean: string[] }> = {
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
function parseCustomArgs(cmd: string[], engine: 'vllm' | 'llamacpp'): CustomParam[] {
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

  if (detectEngine(cmd) === 'comfyui') {
    // The comfyui-worker template's commandFile carries this command, not an engine flag set — there
    // are no launch params to recover from it (see buildEngineCommand). Report that honestly, with
    // engine: 'comfyui', rather than falling through to the vLLM branch below and mislabelling the
    // service as one.
    return { modelId: null, params: buildModelDefaults(null, '', 'comfyui') };
  }

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
 * Container env for a ComfyUI worker launch: the weight files its preset names, in the
 * "<directory>\t<url>" form the bootstrap reads. Sent as userData, which ocean.js ECIES-encrypts
 * in transit — the same channel the bundle templates use for COMFY_WORKFLOW.
 *
 * Throws on an unknown variant rather than sending an empty list: the bootstrap SILENTLY SKIPS any
 * line it can't parse, so a bad list produces a worker that starts, serves an empty model tree, and
 * only fails once the user queues a prompt — after the escrow is claimed.
 */
export function comfyUserData(params: ComfyUIParameters, modelId: string): Record<string, string> {
  const preset = getComfyPresets(modelId).find((p) => p.id === params.variant);
  if (!preset) {
    throw new Error(`No preset "${params.variant}" for model ${modelId}`);
  }
  // The bootstrap SILENTLY SKIPS any line whose directory fails ^[a-z0-9_]{1,32}$ or whose URL is not
  // under https://huggingface.co/. Skipped silently means the worker starts, the weight is simply
  // absent, and the user finds out as a red loader node — after the escrow is claimed. Same two rules,
  // enforced here, where the failure is still free.
  const skipped = preset.files.filter(
    (f) => !/^[a-z0-9_]{1,32}$/.test(f.directory) || !f.url.startsWith('https://huggingface.co/')
  );
  if (skipped.length > 0) {
    throw new Error(
      `Preset "${preset.id}" for ${modelId} lists ${skipped.length} file(s) the ComfyUI bootstrap would skip: ` +
        skipped.map((f) => `${f.directory} ${f.url}`).join(', ')
    );
  }
  return { COMFY_MODEL_FILES: comfyModelFilesEnv(preset) };
}

/**
 * Why a GPU selection can't be turned into a request against a freshly-read environment. Both are
 * recoverable by re-picking, but they are NOT the same thing to tell the user, and only the first is
 * about contention:
 *
 *  - `gpus_taken`   — the type is still advertised, fewer units of it are free than were picked.
 *                     Another tenant booked them between the read the selection was made against
 *                     and this one.
 *  - `gpus_missing` — the environment no longer advertises that GPU type at all. Nobody took it:
 *                     the node's own description for the device changed (an NVML failure renames it
 *                     — live nodes advertise descriptions like "Failed to initialize NVML: …"), or
 *                     the operator reconfigured the env. Blaming another tenant here sends the user
 *                     looking for capacity that will not come back on its own.
 */
export const GPUS_TAKEN = 'gpus_taken';
export const GPUS_MISSING = 'gpus_missing';
/**
 * The shared CPU/RAM/disk the allocation was sized against is no longer free — same contention as
 * `gpus_taken`, on the resources a GPU pick doesn't name. Reported from the same place and for the
 * same reason: the node would reject the serviceStart, and finding that out after the escrow deposit
 * tx costs the user gas for nothing.
 */
export const RESOURCES_TAKEN = 'resources_taken';

export type GpuSelectionErrorCode = typeof GPUS_TAKEN | typeof GPUS_MISSING | typeof RESOURCES_TAKEN;

function gpuSelectionError(code: GpuSelectionErrorCode, message: string): Error & { code: GpuSelectionErrorCode } {
  return Object.assign(new Error(message), { code });
}

/**
 * The reason a GPU selection failed, or null for any other error. Callers switch the wording on it;
 * `null` means the error isn't about the GPU pick and belongs to the generic failure path.
 */
export function gpuSelectionErrorCode(error: unknown): GpuSelectionErrorCode | null {
  const code = (error as { code?: string })?.code;
  return code === GPUS_TAKEN || code === GPUS_MISSING || code === RESOURCES_TAKEN ? code : null;
}

/**
 * User-facing wording for a failed GPU selection, or null when the error is something else (leave
 * those to the caller's generic handler). Shared so the picker and the payment step say the same
 * thing about the same condition — only the "when" differs, hence `since`.
 */
export function gpuSelectionMessage(error: unknown, since: string): string | null {
  const detail = error instanceof Error ? error.message : '';
  switch (gpuSelectionErrorCode(error)) {
    case GPUS_TAKEN:
      return `The GPUs you selected just got booked ${since}. ${detail}`;
    case GPUS_MISSING:
      // Not contention: this type is gone from the environment and won't free up. Move, don't wait.
      return `${detail} Pick another GPU type, or another environment.`;
    case RESOURCES_TAKEN:
      return `This environment ran short of capacity ${since}. ${detail}`;
    default:
      return null;
  }
}

/**
 * Expand the per-GPU-type unit selection into individual GPU resource-id requests. `gpuSelection`
 * is keyed by GPU description (as merged in useInferenceAllocation); each entry asks for N units.
 * Omit / empty selection means "use every free GPU unit" (whole-environment allocation).
 *
 * Units are counted the same way the allocation hook prices them: a resource id contributes
 * `getAvailableAmount(id)` (min(max, total − inUse)) UNITS, which may be >1 for a pooled id. We draw the
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
    // Advertised at all (free or not) vs. free right now — the two tell different stories, so the
    // gone-entirely case is answered from the full GPU list, not just the free one.
    const advertised = gpus.some((gpu) => (gpu.description || 'GPU') === key);
    if (!advertised) {
      throw gpuSelectionError(GPUS_MISSING, `This environment no longer offers "${key}".`);
    }
    const ofType = freeGpus.filter((gpu) => (gpu.description || 'GPU') === key);
    const freeUnits = ofType.reduce((sum, gpu) => sum + getAvailableAmount(gpu), 0);
    if (freeUnits < units) {
      throw gpuSelectionError(
        GPUS_TAKEN,
        `Only ${freeUnits} × "${key}" free right now, ${units} selected. Reduce your selection to continue.`
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

/**
 * Check the priced CPU/RAM/disk amounts still fit what the environment has free.
 *
 * The allocation handed to a launch was sized against the env as it was read when the payment page
 * last rendered, but the ids are resolved from a freshly re-read env at click time. `buildGpuRequests`
 * already catches contention on the GPU units; nothing did for the shared resources, so a tenant
 * taking CPU/RAM/disk in between meant the node rejected the serviceStart AFTER the escrow deposit tx.
 *
 * Throws rather than shrinking the request, for the same reason buildGpuRequests does: a silently
 * reduced allocation provisions less than the user is being charged for.
 */
export function assertAllocationAvailable(resources: ComputeResource[], allocation: Allocation): void {
  const checks: [keyof Allocation, 'cpu' | 'ram' | 'disk', string][] = [
    ['cpu', 'cpu', 'CPU'],
    ['ram', 'ram', 'RAM'],
    ['disk', 'disk', 'disk'],
  ];
  for (const [key, type, label] of checks) {
    const wanted = allocation[key];
    if (!wanted || wanted <= 0) {
      continue;
    }
    const id = resourceId(resources, type);
    const resource = resources.find((r) => r.id === id);
    // Absent from the env: nothing to validate against, and buildInferenceStartParams still names the
    // id — leave that to the node, which is the authority on whether it knows the resource.
    if (!resource) {
      continue;
    }
    const free = getAvailableAmount(resource);
    if (free < wanted) {
      throw gpuSelectionError(
        RESOURCES_TAKEN,
        `Only ${free} ${label} free right now, ${wanted} needed. Reduce your selection or duration to continue.`
      );
    }
  }
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
  appType,
}: {
  model: HuggingFaceModel;
  params: ModelParameters;
  hfToken: string;
  /**
   * Which flow this relaunch came from, so the service's labels keep describing what it now runs.
   * An omitted `metadata` reuses the stored bag, which after a model swap would name the OLD model —
   * so this is re-stamped on every relaunch, not just the ones that change flow.
   */
  appType: ServiceAppType;
}): ServiceRestartParams {
  const runtime = engineRuntime(params);
  // Null only for ComfyUI, whose image and command are the comfyui-worker template's. A relaunch
  // onto that template is buildTemplateRestartParams' job, not this one's — say so rather than
  // sending the node a spec with no image.
  if (!runtime) {
    throw new Error('ComfyUI services relaunch from the comfyui-worker template, not from engine parameters');
  }
  const metadata = buildServiceMetadata({ appType, appId: model.id });
  return {
    image: runtime.image,
    tag: runtime.tag,
    dockerCmd: buildEngineCommand(model, params),
    userData: buildUserData(hfToken),
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Check the engine a launch is configured for can actually serve the model it names.
 *
 * Everything upstream guards the engine held in STATE — the picker assigns it from the model's
 * compatibility, the config step's dropdown hides the impossible options, the URL hydration filter
 * drops a model the restored engine can't serve. None of that guards the per-model launch params,
 * which ride the URL as an unvalidated base64 JSON blob (`decodeModelParams`) and can therefore name
 * any engine for any model however the state was reached.
 *
 * This is the one place every launch passes through, and it runs before the caller's escrow deposit.
 * That is the entire point: `vllm/vllm-openai --model <a diffusion repo>` is a container that
 * crash-loops on weights it cannot load, and without this check the user has already paid for it.
 *
 * Throws rather than correcting the engine, for the same reason assertAllocationAvailable throws:
 * silently launching something other than what was configured and priced is the worse failure.
 */
function assertEngineServesModel(model: HuggingFaceModel, engine: InferenceEngine): void {
  const compatibility = getModelCompatibility(model);
  if (!compatibility.supported) {
    throw new Error(`${model.id} can't be served by any engine this dashboard launches: ${compatibility.reason}`);
  }
  // `both` means either text engine — anything but ComfyUI, which has no weight list for a model
  // absent from the preset table and would start with an empty model tree.
  const required =
    compatibility.engines === 'comfyui-only'
      ? 'comfyui'
      : compatibility.engines === 'llamacpp-only'
        ? 'llamacpp'
        : null;
  if (required ? engine !== required : engine === 'comfyui') {
    throw new Error(
      `${model.id} can only be served by ${required ?? 'vLLM or llama.cpp'}, but this launch is configured for ${engine}.`
    );
  }
}

/**
 * Build the ServiceStartParams to launch a single Hugging Face model. Maps the selected model + its
 * launch params + the chosen environment/allocation into the node's service-start request.
 * `userData` is plaintext here — ocean.js encrypts it.
 *
 * Three engines, one builder: environment, resources, metadata, duration and payment are identical
 * for all of them, and this is the function whose caller runs the escrow lock — a second copy of
 * that arithmetic on the ComfyUI path is exactly the divergence that ends in a paid launch against
 * the wrong allocation. Only the container spec differs, and only ComfyUI's comes from the node.
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
  appType,
  comfyTemplate,
  bucketId,
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
  /**
   * Which of the four flows launched this, stamped into the service's `metadata` alongside the model
   * id so the running service identifies itself instead of having to be matched by image/dockerCmd
   * (see services/service-metadata). Both model flows run the SAME image the node's own inference
   * templates do, which is exactly the collision image matching can't resolve.
   */
  appType: ServiceAppType;
  /**
   * The node's `comfyui-worker` template, for a ComfyUI launch only — it is the sole source of that
   * engine's image, tag, entrypoint and command (its bootstrap is a node-side `commandFile`).
   * Resolve it from the same catalogue the template flow uses; a node that does not advertise it
   * cannot run these models.
   */
  comfyTemplate?: AppTemplate | null;
  /** Persistent-storage bucket to mount at /data/outputs — where ComfyUI writes its renders. */
  bucketId?: string;
}): ServiceStartParams {
  // Before anything else, and before the ComfyUI branch below returns: the engine has to match what
  // the model can actually run on, whatever the params blob claims.
  assertEngineServesModel(model, params.engine);

  const envResources = selectedEnv.environment.resources ?? [];

  // Same freshly-read env the GPU ids are resolved from — so shared-resource contention is caught
  // here too, before the caller runs the escrow deposit tx.
  assertAllocationAvailable(envResources, allocation);

  const resources: ComputeResourceRequest[] = [
    { id: resourceId(envResources, 'cpu'), amount: allocation.cpu },
    { id: resourceId(envResources, 'ram'), amount: allocation.ram },
    { id: resourceId(envResources, 'disk'), amount: allocation.disk },
    ...buildGpuRequests(envResources, gpuSelection ?? selectedEnv.gpuSelection),
  ];

  const metadata = buildServiceMetadata({ appType, appId: model.id });

  const common = {
    environment: selectedEnv.environment.id,
    ...(metadata ? { metadata } : {}),
    resources,
    duration: durationSeconds,
    payment: { chainId: CHAIN_ID, token: tokenAddress },
  };

  // ComfyUI first: engineRuntime() has no answer for it, so this must come before the runtime is
  // dereferenced. Throwing beats any fallback — a bare ComfyUI with no bootstrap starts fine, serves
  // an empty model tree, and only fails when the user queues a prompt, by which point escrow is claimed.
  if (params.engine === 'comfyui') {
    if (!comfyTemplate) {
      throw new Error('This node does not offer the comfyui-worker template');
    }
    // Exactly one image reference, as buildTemplateStartParams does: tag or checksum, never both.
    const imageRef = comfyTemplate.tag
      ? { tag: comfyTemplate.tag }
      : comfyTemplate.checksum
        ? { checksum: comfyTemplate.checksum }
        : {};
    return {
      ...common,
      image: comfyTemplate.image,
      ...imageRef,
      // The template's own ports win; COMFYUI_PORT is the fallback for a template that declares none.
      exposedPorts: comfyTemplate.exposedPorts?.length ? comfyTemplate.exposedPorts : [COMFYUI_PORT],
      ...(comfyTemplate.command?.length ? { dockerCmd: comfyTemplate.command } : {}),
      ...(comfyTemplate.entrypoint?.length ? { dockerEntrypoint: comfyTemplate.entrypoint } : {}),
      // HF_TOKEN too: the bootstrap passes it as a Bearer header on every weight download, so
      // without it a gated repo 401s, `curl -f` fails, and the bootstrap logs FAILED and carries on
      // by design — the same start-with-no-weights-after-payment ending comfyUserData guards against.
      userData: { ...buildUserData(hfToken), ...comfyUserData(params, model.id) },
      ...(bucketId ? { outputBucketId: bucketId } : {}),
    };
  }

  const runtime = engineRuntime(params);
  // Unreachable — engineRuntime is null only for comfyui, returned above. Kept because the
  // alternative on this path is `image: undefined` reaching the node after the escrow lock.
  if (!runtime) {
    throw new Error(`No container image for engine "${params.engine}"`);
  }

  return {
    ...common,
    image: runtime.image,
    tag: runtime.tag,
    exposedPorts: [runtime.port],
    dockerCmd: buildEngineCommand(model, params),
    userData: buildUserData(hfToken),
  };
}
