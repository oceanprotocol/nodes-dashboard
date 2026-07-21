import { InferencePackage } from '@/types/inference';

/**
 * Curated quick-start packages. MOCK DATA — backend doesn't serve packages yet; swap
 * fetchInferencePackages for the real API when it lands.
 *
 * `model` holds only what the card + modal render (id, author, pipelineTag); the full HF model is
 * fetched by id when a package is opened. Model ids are real, ungated HF repos.
 *
 * Each package pins a concrete env by id (peer + env prefix + GPU selection), resolved live from the
 * environments API at selection time. The fee token isn't pinned — it's picked in the modal's env
 * card. Repoint the env below (and gpuSelection key) if the fleet changes.
 */

// Real service-on-demand node. Advertises its GPU as description "NVIDIA Tesla T4" — the gpuSelection
// keys below must match that string exactly or buildGpuRequests can't resolve them.
const NODE_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi';
const NODE_ENV_ID_PREFIX = '0xff1004b67de08fc505fbf0a2089010d0f23015338c7def8557697513c4a39935';

const INFERENCE_PACKAGES: InferencePackage[] = [
  {
    id: 'everyday-chat',
    model: {
      id: 'Qwen/Qwen2.5-7B-Instruct',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    params: {
      servedModelName: 'qwen2.5-7b-instruct',
      customParams: [],
      maxContext: 32768,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'float16',
      kvCacheDtype: 'auto',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'hermes',
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
    },
  },
  {
    id: 'code-assistant',
    model: {
      id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    params: {
      servedModelName: 'qwen2.5-coder-7b-instruct',
      customParams: [],
      maxContext: 32768,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'float16',
      kvCacheDtype: 'auto',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'hermes',
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
    },
  },
  {
    id: 'deep-reasoning',
    model: {
      id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
      author: 'deepseek-ai',
      pipelineTag: 'text-generation',
    },
    params: {
      servedModelName: 'r1-distill-qwen-7b',
      customParams: [],
      maxContext: 32768,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'float16',
      kvCacheDtype: 'auto',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: false,
      toolCallParser: null,
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
    },
  },
  {
    id: 'light-and-fast',
    model: {
      id: 'microsoft/Phi-3.5-mini-instruct',
      author: 'microsoft',
      pipelineTag: 'text-generation',
    },
    params: {
      servedModelName: 'phi-3.5-mini-instruct',
      customParams: [],
      maxContext: 16384,
      gpuMemoryUtilization: 0.85,
      quantization: 'none',
      dtype: 'float16',
      kvCacheDtype: 'auto',
      trustRemoteCode: true,
      enforceEager: false,
      revision: '',
      toolCalling: false,
      toolCallParser: null,
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
    },
  },
];

const MOCK_FETCH_DELAY_MS = 300;

/** Mimics the eventual packages API: resolves the curated list after a short delay. */
export async function fetchInferencePackages(): Promise<InferencePackage[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_FETCH_DELAY_MS));
  return INFERENCE_PACKAGES;
}
