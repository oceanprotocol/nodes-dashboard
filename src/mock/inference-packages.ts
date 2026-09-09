import { InferencePackage, ResourceRequirement } from '@/types/inference';

/**
 * Curated quick-start packages. MOCK DATA — backend doesn't serve packages yet; swap
 * fetchInferencePackages for the real API when it lands.
 *
 * `model` holds only what the card + modal render (id, author, pipelineTag); the full HF model is
 * fetched by id when a package is opened. Model ids are real, ungated HF repos.
 *
 * These mocks stand in for templates fetched from a node — so each carries `sourcePeerIds`, the
 * nodes it may be run on (the list below). The details modal lists every one of those nodes'
 * environments, filtered to those that satisfy `requiredResources`, and the user picks one there.
 */

// Real service-on-demand nodes these mock packages can run on — the modal lists their environments.
// Add more peer ids here to offer a package on more nodes.
const NODE_IDS = ['16Uiu2HAmVa9jQFm4SKrNtYs1QXLzwmMa8YPBCAjEBf8aR8dbLgeE', '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi'];

// Shared resource floors/recommendations — every package targets the same single-GPU footprint.
const REQUIRED_RESOURCES: ResourceRequirement[] = [
  { id: 'cpu', min: 2, recommended: 4, unit: 'cores' },
  { id: 'ram', min: 8, recommended: 16, unit: 'GB' },
  { id: 'disk', min: 10, recommended: 20, unit: 'GB' },
  {
    kind: 'discrete',
    type: 'gpu',
    id: 'gpu',
    min: 1,
    recommended: 1,
    unit: 'count',
    description: 'CUDA-capable GPU with >= 3 GB VRAM (compute capability >= 7.0); both models share the one GPU',
  },
];

export const MOCK_INFERENCE_PACKAGES: InferencePackage[] = [
  {
    id: 'everyday-chat',
    model: {
      // id: 'Qwen/Qwen2.5-7B-Instruct',
      id: 'Qwen/Qwen2.5-0.5B-Instruct',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    params: {
      engine: 'vllm',
      // servedModelName: 'qwen2.5-7b-instruct',
      servedModelName: 'qwen2.5-0.5b-instruct',
      customParams: [],
      // maxContext: 32768,
      maxContext: 8192,
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
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: REQUIRED_RESOURCES,
  },
  {
    id: 'code-assistant',
    model: {
      id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    params: {
      engine: 'vllm',
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
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: REQUIRED_RESOURCES,
  },
  {
    id: 'deep-reasoning',
    model: {
      id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
      author: 'deepseek-ai',
      pipelineTag: 'text-generation',
    },
    params: {
      engine: 'vllm',
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
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: REQUIRED_RESOURCES,
  },
  {
    id: 'light-and-fast',
    model: {
      id: 'microsoft/Phi-3.5-mini-instruct',
      author: 'microsoft',
      pipelineTag: 'text-generation',
    },
    // Showcases the llama.cpp engine: a GGUF quantization. This package pins the same GPU env as the
    // others (the node's only advertised env), so gpuLayers offloads the whole model to that GPU —
    // Phi-3.5-mini (3.8B) at Q4_K_M fits well inside a T4's 16 GB. Set gpuLayers to 0 only on a
    // package pinned to a GPU-less env (none on this node yet), or it books a GPU it never uses.
    params: {
      engine: 'llamacpp',
      servedModelName: 'phi-3.5-mini-instruct',
      customParams: [],
      ggufRepo: 'bartowski/Phi-3.5-mini-instruct-GGUF',
      ggufQuant: 'Q4_K_M',
      contextLength: 16384,
      gpuLayers: 99,
      jinja: true,
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: REQUIRED_RESOURCES,
  },
];

const MOCK_FETCH_DELAY_MS = 300;

/** Mimics the eventual packages API: resolves the curated list after a short delay. */
export async function fetchInferencePackages(): Promise<InferencePackage[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_FETCH_DELAY_MS));
  return MOCK_INFERENCE_PACKAGES;
}
