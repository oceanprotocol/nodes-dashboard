import { InferencePackage, ResourceRequirement } from '@/types/inference';

/**
 * Curated quick-start packages — the hand-picked catalogue shown alongside the templates nodes advertise.
 *
 * Only vLLM-servable text models live here — `InferencePackage.params` is discriminated on
 * `engine: 'vllm' | 'llamacpp'`, so TTS / text-to-image / video models (ComfyUI, diffusers,
 * kokoro-fastapi, …) cannot be expressed until those engines exist.
 *
 * `model` holds only what the card + modal render (id, author, pipelineTag); the full HF model is
 * fetched by id when a package is opened.
 *
 * Each package carries `sourcePeerIds` — the nodes it may be run on. The details modal lists every
 * one of those nodes' environments, filtered to those that satisfy `requiredResources`, and the user
 * picks one there.
 */

// Service-on-demand nodes these packages can run on — the modal lists their environments.
// Add more peer ids here to offer the packages on more nodes.
const NODE_IDS = ['16Uiu2HAmVa9jQFm4SKrNtYs1QXLzwmMa8YPBCAjEBf8aR8dbLgeE', '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi'];

/**
 * Resource floors for a package, built from its VRAM footprint and GPU count. `vramGb` is the
 * weights + KV-cache headroom per GPU (H200 = 141 GB/GPU), `gpus` the tensor-parallel width; both
 * are taken from the curated footprint column. CPU/RAM/disk scale with the GPU count — vLLM needs
 * host RAM to stage weights and disk to cache the HF download.
 */
function resources(gpus: number, vramGb: number, diskGb: number): ResourceRequirement[] {
  return [
    { id: 'cpu', min: 4 * gpus, recommended: 8 * gpus, unit: 'cores' },
    { id: 'ram', min: 16 * gpus, recommended: 32 * gpus, unit: 'GB' },
    { id: 'disk', min: diskGb, recommended: Math.round(diskGb * 1.5), unit: 'GB' },
    {
      kind: 'discrete',
      type: 'gpu',
      id: 'gpu',
      min: gpus,
      recommended: gpus,
      unit: 'count',
      description: `${gpus} CUDA GPU${gpus > 1 ? 's' : ''} with >= ${vramGb} GB VRAM each (compute capability >= 8.0 for FP8 KV cache)`,
    },
  ];
}

export const INFERENCE_QUICKSTART_PACKAGES: InferencePackage[] = [
  {
    id: 'everyday-chat',
    model: {
      id: 'Qwen/Qwen3-8B',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description: 'Fast, lightweight general chat model. The lowest-risk starting point — smallest footprint here, so it runs almost anywhere.',
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3-8b',
      customParams: [],
      maxContext: 16384,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'bfloat16',
      kvCacheDtype: 'fp8',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'hermes',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources(1, 24, 40),
  },
  {
    id: 'balanced-chat',
    model: {
      id: 'Qwen/Qwen3-32B',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description: 'Noticeably sharper answers than the 8B at the cost of a bigger GPU. Best dense model that still fits one GPU at full precision.',
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3-32b',
      customParams: [],
      maxContext: 32768,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'bfloat16',
      kvCacheDtype: 'fp8',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'hermes',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources(1, 80, 130),
  },
  {
    id: 'fast-multimodal-chat',
    model: {
      id: 'Qwen/Qwen3.6-35B-A3B-FP8',
      author: 'Qwen',
      pipelineTag: 'image-text-to-text',
    },
    description: 'Understands images as well as text, and stays quick — only ~3B of its 35B parameters run per token.',
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3.6-35b-a3b',
      customParams: [],
      maxContext: 32768,
      gpuMemoryUtilization: 0.9,
      quantization: 'fp8',
      dtype: 'auto',
      kvCacheDtype: 'fp8',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'hermes',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources(1, 60, 90),
  },
  {
    id: 'flagship-chat',
    model: {
      id: 'openai/gpt-oss-120b',
      author: 'openai',
      pipelineTag: 'text-generation',
    },
    description: "OpenAI's open flagship — the highest quality on this list, and it still runs on a single GPU thanks to native MXFP4 weights.",
    params: {
      engine: 'vllm',
      servedModelName: 'gpt-oss-120b',
      customParams: [],
      maxContext: 32768,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'auto',
      kvCacheDtype: 'auto',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'hermes',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources(1, 90, 150),
  },
  {
    id: 'code-assistant',
    model: {
      id: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description: 'Built for coding and agentic tool use, with a 64k context for whole-repo work. Fast: only ~3B active parameters per token.',
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3-coder-30b-a3b',
      customParams: [],
      maxContext: 65536,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'bfloat16',
      kvCacheDtype: 'fp8',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'qwen3_coder',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources(1, 80, 120),
  },
  // Code, 2 GPUs — sharded with --tensor-parallel-size 2. Needs a vLLM build carrying the qwen3_next
  // architecture; on an older image the server exits at startup with an unknown-arch error.
  {
    id: 'code-assistant-xl',
    model: {
      id: 'Qwen/Qwen3-Coder-Next',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description: "Qwen's newest coding architecture, sharded across two GPUs. Stronger than the 30B coder on large, multi-file work.",
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3-coder-next',
      customParams: [],
      maxContext: 65536,
      tensorParallelSize: 2,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'bfloat16',
      kvCacheDtype: 'fp8',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'hermes',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources(2, 90, 340),
  },
  // General, 2 GPUs — frontier-family reasoning at the cheapest multi-GPU tier. Ships official FP8
  // weights and a custom architecture, hence trustRemoteCode; needs a vLLM/SGLang build with
  // deepseek_v4 support.
  {
    id: 'deep-reasoning',
    model: {
      id: 'deepseek-ai/DeepSeek-V4-Flash',
      author: 'deepseek-ai',
      pipelineTag: 'text-generation',
    },
    description: 'Frontier-grade reasoning for hard, multi-step problems. Thinks longer than the chat models, and spans two GPUs.',
    params: {
      engine: 'vllm',
      servedModelName: 'deepseek-v4-flash',
      customParams: [],
      maxContext: 32768,
      tensorParallelSize: 2,
      gpuMemoryUtilization: 0.9,
      quantization: 'fp8',
      dtype: 'auto',
      kvCacheDtype: 'fp8',
      trustRemoteCode: true,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'deepseek_v3',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources(2, 120, 500),
  },
];
