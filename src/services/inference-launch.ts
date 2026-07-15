import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { CHAIN_ID } from '@/constants/chains';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { buildModelDefaults } from '@/services/huggingface-service';
import { ComputeResource } from '@/types/environments';
import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
import { ComputeResourceRequest, ServiceStartParams } from '@oceanprotocol/lib';

/**
 * The container image + port for the "any Hugging Face model on vLLM" service. Mirrors
 * ocean-node's `docs/serviceTemplates/vllm-hf-model.json`: the OpenAI-compatible vLLM server
 * serving a single HF model, listening on port 8000.
 */
export const VLLM_IMAGE = 'vllm/vllm-openai';
export const VLLM_TAG = process.env.NEXT_PUBLIC_VLLM_TAG ?? 'latest';
export const VLLM_PORT = 8000;

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
 * Turn the model launch parameters into the vLLM server command (Docker CMD, exec-form).
 * Every arg is a separate array element (exec form — no shell). `--max-model-len` /
 * `--gpu-memory-utilization` are only emitted when they hold a valid value: a NaN/0/empty
 * value stringifies to a garbage flag (`--max-model-len NaN`) that makes vLLM exit 1 at startup,
 * so we drop it and let vLLM derive the default from the model config instead.
 */
export function buildVllmCommand(model: HuggingFaceModel, params: ModelParameters): string[] {
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
 * Reverse of buildVllmCommand: recover the model id + launch params from a running service's
 * dockerCmd (the node returns the command, not the original ModelParameters). Used by the manage
 * page to rebuild the params for a service opened without them in the URL. Flags absent from the
 * command fall back to buildModelDefaults' neutral values; customParams can't be recovered from the
 * command (they live in the encrypted userData), so they come back empty.
 */
export function parseVllmCommand(cmd: string[]): { modelId: string | null; params: ModelParameters } {
  // Read the value following a flag, or undefined when the flag is absent / has no value.
  const valueOf = (flag: string): string | undefined => {
    const idx = cmd.indexOf(flag);
    return idx >= 0 && idx + 1 < cmd.length ? cmd[idx + 1] : undefined;
  };
  const has = (flag: string): boolean => cmd.includes(flag);

  const modelId = valueOf('--model') ?? null;
  const defaults = buildModelDefaults(null, modelId ?? '');

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
      dtype: (dtype as ModelParameters['dtype']) ?? defaults.dtype,
      quantization: (quantization as ModelParameters['quantization']) ?? defaults.quantization,
      kvCacheDtype: (kvCacheDtype as ModelParameters['kvCacheDtype']) ?? defaults.kvCacheDtype,
      revision: valueOf('--revision') ?? defaults.revision,
      trustRemoteCode: has('--trust-remote-code'),
      enforceEager: has('--enforce-eager'),
      toolCalling: has('--enable-auto-tool-choice'),
      toolCallParser: (valueOf('--tool-call-parser') as ModelParameters['toolCallParser']) ?? defaults.toolCallParser,
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
    if (key) {
      userData[key] = value;
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
 * is keyed by GPU description (as merged in useInferenceAllocation); each entry asks for N units,
 * which we satisfy by taking the first N gpu resources of that description. Omit / empty selection
 * means "use every GPU unit" (whole-environment allocation).
 */
function buildGpuRequests(resources: ComputeResource[], gpuSelection?: GpuSelection): ComputeResourceRequest[] {
  const gpus = resources.filter((r) => r.type === 'gpu' || r.id.toLowerCase().includes('gpu'));
  if (gpus.length === 0) {
    return [];
  }

  // No explicit selection → request every GPU unit.
  if (!gpuSelection || Object.keys(gpuSelection).length === 0) {
    return gpus.map((gpu) => ({ id: gpu.id, amount: 1 }));
  }

  const requests: ComputeResourceRequest[] = [];
  for (const [key, units] of Object.entries(gpuSelection)) {
    const ofType = gpus.filter((gpu) => (gpu.description || 'GPU') === key);
    // Take the first `units` resource ids of this description; each GPU unit is amount 1.
    for (let i = 0; i < Math.min(units, ofType.length); i++) {
      requests.push({ id: ofType[i].id, amount: 1 });
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
  allocation,
  durationSeconds,
  tokenAddress,
  hfToken,
}: {
  model: HuggingFaceModel;
  params: ModelParameters;
  selectedEnv: SelectedInferenceEnv;
  allocation: Allocation;
  durationSeconds: number;
  tokenAddress: string;
  hfToken: string;
}): ServiceStartParams {
  const envResources = selectedEnv.environment.resources ?? [];

  const resources: ComputeResourceRequest[] = [
    { id: resourceId(envResources, 'cpu'), amount: allocation.cpu },
    { id: resourceId(envResources, 'ram'), amount: allocation.ram },
    { id: resourceId(envResources, 'disk'), amount: allocation.disk },
    ...buildGpuRequests(envResources, selectedEnv.gpuSelection),
  ];

  return {
    environment: selectedEnv.environment.id,
    image: VLLM_IMAGE,
    tag: VLLM_TAG,
    exposedPorts: [VLLM_PORT],
    dockerCmd: buildVllmCommand(model, params),
    userData: buildUserData(params, hfToken),
    resources,
    duration: durationSeconds,
    payment: { chainId: CHAIN_ID, token: tokenAddress },
  };
}
