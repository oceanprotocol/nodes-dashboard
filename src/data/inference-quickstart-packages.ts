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
// Order matters: use-package-env resolves these in sequence, so the first reachable node's
// environments are the ones the modal offers first.
const NODE_IDS = ['16Uiu2HAm94yL3Sjem2piKmGkiHCdJyTn3F3aWueZTXKT38ekjuzr', '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi'];

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
      // Qwen2.x emits Hermes-style <tool_call> blocks.
      toolCallParser: 'hermes',
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
      // Qwen3 moved to an XML tool-call format; the Hermes parser mis-reads it.
      toolCallParser: 'qwen3_xml',
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
      toolCallParser: 'qwen3_xml',
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
    id: 'advanced-multimodal-chat',
    model: {
      id: 'Qwen/Qwen3.8-27B',
      author: 'Qwen',
      pipelineTag: 'image-text-to-text',
    },
    description:
      'Dense 27B reasoning model for coding, agentic work, and image understanding, with its full native 256k context window.',
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3.8-27b',
      // Qwen3.8 emits <think> blocks; this separates reasoning from final content in the OpenAI API.
      customParams: [{ key: 'reasoning-parser', value: 'qwen3' }],
      maxContext: 262144,
      gpuMemoryUtilization: 0.9,
      // The official checkpoint is BF16: 55.6 GB of weights (51.7 GiB) before runtime/cache overhead.
      quantization: 'none',
      dtype: 'bfloat16',
      // Only 16 of 64 layers use full attention, with 4 KV heads; FP8 keeps the 256k cache practical.
      kvCacheDtype: 'fp8',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      // Its chat template uses Qwen's XML <tool_call>/<function>/<parameter> format.
      toolCallParser: 'qwen3_xml',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      // Full native context is proven on 96 GB cards; this deliberately excludes marginal 80 GB fits.
      vramGb: 90,
      computeCapability: 8.0,
      cpu: { min: 8, recommended: 16 },
      ram: { min: 64, recommended: 96 },
      disk: { min: 70, recommended: 90 },
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
      toolCallParser: 'qwen3_xml',
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
      // The model's native window (config.json: max_position_embeddings 262144, rope_scaling null —
      // no YaRN needed). Cheap here because only 12 of the 48 layers hold a KV cache at all
      // (full_attention_interval 4; the other 36 are Gated DeltaNet, a fixed per-sequence state):
      // 2 kv heads x 256 head_dim at fp8, head-sharded over TP=2, is ~1.5 GiB per rank for a
      // full-length sequence against ~44 GiB free on a 141 GB card.
      maxContext: 262144,
      tensorParallelSize: 2,
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
      gpus: 2,
      // 40 bf16 shards, 159.4 GB. TP=2 puts 74.2 GiB of weights on each GPU, which an 80 GB card
      // cannot hold (67.1 GiB usable at util 0.9), so this floor admits only 96 and 141 GB cards.
      vramGb: 90,
      computeCapability: 8.0,
      cpu: { min: 12, recommended: 24 },
      ram: { min: 200, recommended: 320 },
      disk: { min: 200, recommended: 280 },
    }),
  },
  // Official fine-grained FP8 checkpoint of Coder Next, on ONE card. The model is MoE: all 80B
  // parameters must remain resident, but the router selects 10 of 512 experts (plus one shared
  // expert), so only about 3B parameters are active for each token.
  //
  // Qwen's published recipe says TP=2, because it is written for the bf16 repo (148.42 GiB, which
  // no single card holds). This checkpoint is 80,396,214,083 bytes = 74.87 GiB, so it fits one
  // 141 GB card with room to serve — and single-card is strictly better here: no all-reduce per
  // layer, no NCCL rendezvous, no /dev/shm dependency. The bf16 sibling (code-assistant-xl) stays
  // the two-GPU tier.
  {
    id: 'code-assistant-xl-fp8',
    model: {
      id: 'Qwen/Qwen3-Coder-Next-FP8',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description: 'Agentic coding model with 80B total but only ~3B active parameters per token. Official FP8 weights and a native 256k context, on a single GPU.',
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3-coder-next-fp8',
      customParams: [],
      maxContext: 262144,
      // No tensorParallelSize: one GPU. buildVllmCommand only emits --tensor-parallel-size above 1,
      // and vLLM's own default is 1, so the flag is simply absent.
      gpuMemoryUtilization: 0.9,
      // 'none' so the flag is omitted and vLLM reads the checkpoint's own quantization_config.
      // That config carries a long `modules_to_not_convert` list — the MoE gates, shared-expert
      // gates, conv1d, in_proj_ba, embed_tokens and lm_head all stay bf16. Naming the format on the
      // command line risks a loader that applies its own default exclusions instead of these.
      quantization: 'none',
      dtype: 'auto',
      kvCacheDtype: 'fp8',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      // Coder Next is explicitly non-thinking: do not add --reasoning-parser.
      toolCalling: true,
      toolCallParser: 'qwen3_coder',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      // 74.87 GiB of weights against 118.20 GiB usable on a 141 GB card at util 0.9 — 43.33 GiB
      // left for KV. At TP=1 the cache is no longer head-sharded, so a full 262,144-token sequence
      // costs the whole 12 KiB/token (2 x 12 full-attn layers x 2 kv heads x 256 head_dim at fp8)
      // = 3.00 GiB, i.e. ~14 concurrent max-length requests. A 96 GB card would hold the weights
      // with only 5.6 GiB spare, which will not serve this context; an 80 GB card cannot hold them
      // at all. Hence a floor above the weights themselves.
      vramGb: 130,
      computeCapability: 8.9,
      cpu: { min: 12, recommended: 24 },
      ram: { min: 96, recommended: 160 },
      disk: { min: 100, recommended: 140 },
    }),
  },
  // Moonshot's verified vLLM layout is one 8x H200 node with TP=8. This is a 1T-parameter MoE:
  // every expert's weights remain resident (~595 GB checkpoint), while the router activates only
  // 8 of 384 routed experts plus one shared expert, for roughly 32B active parameters per token.
  {
    id: 'agentic-code-flagship',
    model: {
      id: 'moonshotai/Kimi-K2.7-Code',
      author: 'moonshotai',
      pipelineTag: 'image-text-to-text',
    },
    description:
      'Flagship multimodal coding agent: 1T total parameters, ~32B active per token, native 256k context, sharded across 8 H200 GPUs.',
    params: {
      engine: 'vllm',
      servedModelName: 'kimi-k2.7-code',
      customParams: [
        // Moonshot requires this parser because K2.7 Code always reasons before answering.
        { key: 'reasoning-parser', value: 'kimi_k2' },
        // Replicate the small vision encoder across ranks instead of tensor-sharding it.
        { key: 'mm-encoder-tp-mode', value: 'data' },
      ],
      maxContext: 262144,
      tensorParallelSize: 8,
      gpuMemoryUtilization: 0.9,
      // The repository carries native compressed-tensors INT4 metadata; vLLM detects it from the
      // checkpoint. Passing one of the unrelated fp8/awq/gptq flags would select the wrong loader.
      quantization: 'none',
      dtype: 'auto',
      // Match Moonshot's verified command. MLA already makes this cache far smaller than standard
      // multi-head attention; users can opt into FP8 KV cache after validating their vLLM build.
      kvCacheDtype: 'auto',
      trustRemoteCode: true,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'kimi_k2',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 8,
      // The official recipe targets 141 GB H200s; this floor excludes marginal 80 GB layouts.
      vramGb: 130,
      computeCapability: 9.0,
      cpu: { min: 48, recommended: 96 },
      ram: { min: 512, recommended: 768 },
      // The Hub repository is ~595 GB, plus download/runtime staging headroom.
      disk: { min: 650, recommended: 750 },
    }),
  },
  // General, 2 GPUs — frontier-family reasoning at the cheapest multi-GPU tier. The checkpoint is
  // ALREADY a mixed-precision quantized artifact: config.json carries `quantization_config`
  // {quant_method: fp8, fmt: e4m3, scale_fmt: ue8m0, weight_block_size [128,128]} for the dense and
  // attention weights, plus `expert_dtype: "fp4"` for the 256 routed experts — 290.9B parameters in
  // 159.64 GB, i.e. ~4.4 bits per parameter. There is no worthwhile smaller repo: the community
  // W4A16 conversions are LARGER (182.5 GB — 4-bit weights unpack into int32 containers with fp32
  // scales), and every NVFP4 build needs Blackwell FP4 tensor cores that Hopper does not have.
  // Custom architecture (DeepseekV4ForCausalLM), hence trustRemoteCode; needs a vLLM build with
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
      // The three deepseek_v4 flags are load-bearing, and none has a typed form field:
      //  - tokenizer-mode: the checkpoint ships encoding scripts under encoding/ INSTEAD of a Jinja
      //    chat template, so without this /v1/chat/completions has no template to apply.
      //  - reasoning-parser: the model always thinks; without it the thinking text is returned as
      //    ordinary content with any tool call buried inside it.
      //  - block-size: from the model's own vLLM recipe.
      customParams: [
        { key: 'tokenizer-mode', value: 'deepseek_v4' },
        { key: 'reasoning-parser', value: 'deepseek_v4' },
        { key: 'block-size', value: '256' },
        // Caps concurrency to keep the KV pool reachable at this context on only two cards —
        // max-num-seqs moves the achievable context far more than gpu-memory-utilization does.
        { key: 'max-num-seqs', value: '8' },
      ],
      // config.json: max_position_embeddings 1048576 via YaRN (factor 16 over a 65536 base window).
      // 262144 matches the other curated entries and is 8x what this package used to advertise. The
      // ocean-node deepseek-harness template defaults to 393216, but at its RECOMMENDED four cards
      // — validate before raising this one, since an unreachable context is a startup failure
      // (`ValueError: … estimated maximum model length is N`) inside the paid window.
      maxContext: 262144,
      tensorParallelSize: 2,
      gpuMemoryUtilization: 0.9,
      // MUST stay 'none' so the flag is omitted and vLLM reads quantization_config itself. Naming
      // fp8 here would apply one format to a checkpoint whose experts are fp4 and whose scales are
      // ue8m0. The model's own recipe passes neither --quantization nor --dtype.
      quantization: 'none',
      dtype: 'auto',
      kvCacheDtype: 'fp8',
      trustRemoteCode: true,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      // deepseek_v4, not deepseek_v3 — verified against the recipe the harness template runs.
      toolCallParser: 'deepseek_v4',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 2,
      // 159.64 GB = 148.68 GiB; TP=2 puts 74.34 GiB of weights on each card, leaving 43.86 GiB for
      // KV on a 141 GB one. A 96 GB card would fit the shard with only ~6 GiB spare, which will not
      // hold this context — hence a floor that asks for more than the shard itself.
      vramGb: 120,
      // FP8 weights — Hopper/Ada only.
      computeCapability: 8.9,
      cpu: { min: 12, recommended: 24 },
      ram: { min: 200, recommended: 320 },
      disk: { min: 200, recommended: 280 },
    }),
  },
  // Zhipu's flagship, natively multimodal. Native FP8, ~299 GiB, TP=4 per Zhipu's own recipe (80 GB/GPU shard).
  {
    id: 'flagship-multimodal-chat',
    model: {
      id: 'zai-org/GLM-5.3-Flash',
      author: 'zai-org',
      pipelineTag: 'image-text-to-text',
    },
    description: "Zhipu's flagship multimodal MoE — 320B total, 18B active per token, natively reads text, images and video, sharded across 4 GPUs.",
    params: {
      engine: 'vllm',
      servedModelName: 'glm-5.3-flash',
      customParams: [{ key: 'reasoning-parser', value: 'glm45' }],
      maxContext: 262144,
      tensorParallelSize: 4,
      gpuMemoryUtilization: 0.9,
      // 'none': let vLLM read the checkpoint's own FP8 quantization_config.
      quantization: 'none',
      dtype: 'auto',
      // Zhipu's recipe: Hopper has no FP8 KV cache for this model, must run BF16.
      kvCacheDtype: 'auto',
      // Custom architecture (Glm5NextForConditionalGeneration).
      trustRemoteCode: true,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'glm47',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 4,
      // 80 GB/GPU shard — a 96 GB card leaves only ~6 GB for KV; 141 GB is the comfortable floor.
      vramGb: 120,
      computeCapability: 8.9,
      cpu: { min: 24, recommended: 48 },
      ram: { min: 320, recommended: 420 },
      disk: { min: 340, recommended: 420 },
    }),
  },
  // Qwen4-preview MoE, official FP8 checkpoint (~176 GiB). TP=4 on H200 is not vendor-verified —
  // needs real-world confirmation it loads.
  {
    id: 'agentic-multimodal-flagship',
    model: {
      id: 'Qwen/Qwen3.8-Flash-Next-FP8',
      author: 'Qwen',
      pipelineTag: 'image-text-to-text',
    },
    description:
      "Preview of Qwen's next-generation architecture: 125B MoE + a 51B n-gram table, only ~6B active per token, native 256k context, multimodal. Sharded across 4 GPUs.",
    params: {
      engine: 'vllm',
      servedModelName: 'qwen3.8-flash-next-fp8',
      customParams: [
        { key: 'reasoning-parser', value: 'qwen3' },
        { key: 'enable-prefix-caching', value: '' },
        { key: 'no-enable-flashinfer-autotune', value: '' },
        { key: 'moe-backend', value: 'triton' },
        { key: 'max-num-seqs', value: '256' },
      ],
      maxContext: 262144,
      tensorParallelSize: 4,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'auto',
      kvCacheDtype: 'auto',
      // model_type qwen4_exp — preview architecture, not yet in mainline transformers/vLLM.
      trustRemoteCode: true,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'qwen3_xml',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 4,
      vramGb: 130,
      computeCapability: 8.9,
      cpu: { min: 24, recommended: 48 },
      ram: { min: 220, recommended: 320 },
      disk: { min: 210, recommended: 280 },
    }),
  },
];
