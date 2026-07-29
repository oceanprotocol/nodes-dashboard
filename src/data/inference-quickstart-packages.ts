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
 * are taken from the curated footprint column. vLLM needs host RAM to stage weights and disk to
 * cache the HF download, so `cpu` (cores) / `ram` (GB) / `disk` (GB) are the host-side floors — each
 * package states its own min and recommended, no implicit scaling.
 *
 * `computeCapability` is the CUDA arch floor the package's params imply — FP8 weights need >= 8.9,
 * bf16 and an FP8 KV cache need >= 8.0, and fp16 + AWQ run down to 7.5 (Turing, e.g. a T4).
 */
function resources({
  gpus,
  vramGb,
  computeCapability,
  cpu,
  ram,
  disk,
}: {
  gpus: number;
  vramGb: number;
  computeCapability: number;
  cpu: { min: number; recommended: number };
  ram: { min: number; recommended: number };
  disk: { min: number; recommended: number };
}): ResourceRequirement[] {
  return [
    { id: 'cpu', min: cpu.min, recommended: cpu.recommended, unit: 'cores' },
    { id: 'ram', min: ram.min, recommended: ram.recommended, unit: 'GB' },
    { id: 'disk', min: disk.min, recommended: disk.recommended, unit: 'GB' },
    {
      kind: 'discrete',
      type: 'gpu',
      id: 'gpu',
      min: gpus,
      recommended: gpus,
      unit: 'count',
      description: `${gpus} CUDA GPU${gpus > 1 ? 's' : ''} with >= ${vramGb} GB VRAM each (compute capability >= ${computeCapability})`,
    },
  ];
}

export const INFERENCE_QUICKSTART_PACKAGES: InferencePackage[] = [
  {
    id: 'lightweight-chat',
    model: {
      id: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description: 'A smaller footprint and wider hardware reach — int4 weights fit a single 16 GB GPU, down to a T4. Start here if you are unsure a node can hold anything bigger.',
    params: {
      engine: 'vllm',
      servedModelName: 'qwen2.5-7b-instruct',
      customParams: [],
      maxContext: 16384,
      gpuMemoryUtilization: 0.9,
      // AWQ int4 (~5.6 GB) instead of the 15.2 GB fp16 weights — the only way a 7B fits 16 GB.
      // float16 + an unquantized KV cache keep it on Turing (T4): bf16 and FP8 both need >= 8.0.
      quantization: 'awq',
      dtype: 'float16',
      kvCacheDtype: 'auto',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'openai',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      vramGb: 16,
      computeCapability: 7.5,
      cpu: { min: 2, recommended: 4 },
      ram: { min: 8, recommended: 14 },
      disk: { min: 10, recommended: 16 },
    }),
  },
  {
    id: 'everyday-chat',
    model: {
      id: 'Qwen/Qwen3-8B',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description: 'Fast general chat at full precision, with reasoning built in. A sharper pick than the lightweight tier wherever a 24 GB GPU is free.',
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
      toolCallParser: 'openai',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      vramGb: 24,
      computeCapability: 8.0,
      cpu: { min: 4, recommended: 8 },
      ram: { min: 16, recommended: 32 },
      disk: { min: 40, recommended: 60 },
    }),
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
      toolCallParser: 'openai',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      vramGb: 80,
      computeCapability: 8.0,
      cpu: { min: 4, recommended: 8 },
      ram: { min: 16, recommended: 32 },
      disk: { min: 130, recommended: 195 },
    }),
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
      toolCallParser: 'openai',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      vramGb: 60,
      // FP8 weights — needs Hopper or Ada (SM 8.9+), not just Ampere.
      computeCapability: 8.9,
      cpu: { min: 4, recommended: 8 },
      ram: { min: 16, recommended: 32 },
      disk: { min: 90, recommended: 135 },
    }),
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
      toolCallParser: 'openai',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      vramGb: 90,
      // Native MXFP4 kernels are Hopper+; on older cards vLLM upconverts and no longer fits 90 GB.
      computeCapability: 9.0,
      cpu: { min: 4, recommended: 8 },
      ram: { min: 16, recommended: 32 },
      disk: { min: 150, recommended: 225 },
    }),
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
    requiredResources: resources({
      gpus: 1,
      vramGb: 80,
      computeCapability: 8.0,
      cpu: { min: 4, recommended: 8 },
      ram: { min: 16, recommended: 32 },
      disk: { min: 120, recommended: 180 },
    }),
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
    requiredResources: resources({
      gpus: 2,
      vramGb: 90,
      computeCapability: 8.0,
      cpu: { min: 8, recommended: 16 },
      ram: { min: 32, recommended: 64 },
      disk: { min: 340, recommended: 510 },
    }),
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
    requiredResources: resources({
      gpus: 2,
      vramGb: 120,
      // FP8 weights — Hopper/Ada only.
      computeCapability: 8.9,
      cpu: { min: 8, recommended: 16 },
      ram: { min: 32, recommended: 64 },
      disk: { min: 500, recommended: 750 },
    }),
  },
];
