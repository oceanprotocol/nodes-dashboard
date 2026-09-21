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
const NODE_IDS = [
  '16Uiu2HAm94yL3Sjem2piKmGkiHCdJyTn3F3aWueZTXKT38ekjuzr',
  '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
];

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

/**
 * Ordered by hardware tier: ascending `(gpus, vramGb)` taken from each entry's `requiredResources`.
 * This array's order IS the render order — nothing sorts downstream (use-default-model-packages
 * concatenates it after the node-advertised templates, default-models-page maps it straight into a
 * two-column grid) — so each tier reads as one row and the widest-runnable packages come first.
 * That matters because a card advertises no availability: a package whose floors no reachable node
 * meets looks identical in the grid and only reveals itself as an empty environment list once the
 * details modal filters envs against `requiredResources`. Keep new entries in tier order, and keep
 * quantized siblings of one model adjacent so the trade-off between them is visible side by side.
 */
export const INFERENCE_QUICKSTART_PACKAGES: InferencePackage[] = [
  // The cheapest entry in the catalogue, and deliberately first: 30B of bf16 weights is the whole
  // cost, because the cache is nearly free (see below). v0.28.0 registers
  // MuseGlimmerForConditionalGeneration, so no vllmTag.
  //
  // The repo also publishes a DFlash drafter (Muse-Glimmer-30B-assistant) for speculative decoding.
  // It is deliberately not wired up here — it needs a --speculative-config JSON blob and a second
  // set of weights resident, which the quick-start flow has nowhere to put.
  {
    id: 'compact-agentic-chat',
    model: {
      id: 'meta-models/Muse-Glimmer-30B',
      author: 'meta-models',
      pipelineTag: 'image-text-to-text',
    },
    description:
      'Agentic 30B model built for long tool-using workflows, with image understanding and four reasoning strengths, on one GPU.',
    params: {
      engine: 'vllm',
      servedModelName: 'muse-glimmer-30b',
      // The model answers on a separate reasoning channel; without the parser that text arrives as
      // ordinary content. Reasoning STRENGTH is not a flag — the caller writes
      // `Reasoning strength: low|medium|high|xhigh` into the system prompt.
      customParams: [{ key: 'reasoning-parser', value: 'muse_glimmer' }],
      // config.json text_config: max_position_embeddings 131072, plain rope, no scaling.
      maxContext: 131072,
      gpuMemoryUtilization: 0.9,
      // Weights are plain BF16: 59.55 GB (55.46 GiB), no quantization_config.
      quantization: 'none',
      dtype: 'bfloat16',
      // 'auto' (bf16). FP8 would save ~0.9 GiB on a full-length sequence — not worth the risk on a
      // cache this small, and the global layers are NoPE (layer_rope_theta 0), an unusual path.
      kvCacheDtype: 'auto',
      // Native vLLM architecture, and the repo ships no Python.
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      // ATEM protocol — vLLM registers this parser as 'muse_glimmer'.
      toolCallParser: 'muse_glimmer',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      // 55.46 GiB of weights against 67.10 GiB usable on an 80 GB card at util 0.9 — 11.6 GiB left,
      // which is plenty here: only 13 of 52 layers are full attention, at 2 kv heads x 128 head_dim
      // (13 KiB/token in bf16 = 1.66 GiB for a full 131,072-token sequence), and the other 39 slide
      // at a 2048-token window for ~78 MiB total. That is ~6 concurrent max-length requests on the
      // smallest card that holds the weights at all — a 64 GB card (53.6 GiB usable) cannot.
      vramGb: 80,
      computeCapability: 8.0,
      cpu: { min: 8, recommended: 16 },
      ram: { min: 64, recommended: 96 },
      disk: { min: 75, recommended: 95 },
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
  // Dense 31B, one card. vLLM v0.28.0 — the stable fallback tag — already registers
  // Gemma4ForConditionalGeneration (-> gemma4_mm), so no vllmTag is needed here.
  //
  // The cache is hybrid: of 60 layers only 10 are full attention (layer_types, every 6th, last
  // layer always global), the other 50 are sliding with a 1024-token window. The global layers use
  // 4 KV heads x 512 head_dim, the sliding ones 16 x 256.
  {
    id: 'multilingual-multimodal-chat',
    model: {
      id: 'google/gemma-4-31B-it',
      author: 'google',
      pipelineTag: 'image-text-to-text',
    },
    description:
      'Dense 31B multimodal chat model reading text and images across 140+ languages, with a 256k context on a single GPU.',
    params: {
      engine: 'vllm',
      servedModelName: 'gemma-4-31b-it',
      // Gemma 4 thinks before answering; without the parser the thinking text comes back as
      // ordinary content. Registered as 'gemma4' in vLLM's reasoning registry since v0.28.0.
      customParams: [{ key: 'reasoning-parser', value: 'gemma4' }],
      // config.json text_config: max_position_embeddings 262144, no rope scaling needed.
      maxContext: 262144,
      gpuMemoryUtilization: 0.9,
      // Official checkpoint is plain BF16 (no quantization_config): 62.55 GB of weights (58.25 GiB).
      quantization: 'none',
      dtype: 'bfloat16',
      // 'auto' (bf16): FP8 KV is not verified against this hybrid sliding/global cache, and the
      // weights leave enough room at 141 GB without it. Opt in after validating your vLLM build.
      kvCacheDtype: 'auto',
      // Native vLLM architecture, and the repo carries no Python — nothing to trust.
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'gemma4',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      // 58.25 GiB of weights against 118.20 GiB usable on a 141 GB card at util 0.9 — ~59.9 GiB for
      // KV. At bf16 a full 262,144-token sequence costs 80 KiB/token across the 10 global layers
      // (2 x 4 kv heads x 512 head_dim) = 20.0 GiB, plus ~0.8 GiB for the 50 sliding layers (capped
      // at their 1024-token window), so ~2.8 concurrent max-length requests. A 96 GB card leaves
      // 22.2 GiB and serves one; an 80 GB card leaves 8.9 GiB and cannot hold a full-length
      // sequence at all. Hence the same 90 GB floor as the 27B entry above.
      vramGb: 90,
      computeCapability: 8.0,
      cpu: { min: 8, recommended: 16 },
      ram: { min: 80, recommended: 112 },
      disk: { min: 80, recommended: 100 },
    }),
  },
  // MoE on ONE card: 128 experts of which the router picks 4 per token, so 116.8B parameters stay
  // resident but only ~5B are active. v0.28.0 registers GptOssForCausalLM — no vllmTag.
  {
    id: 'fast-reasoning-moe',
    model: {
      id: 'openai/gpt-oss-120b',
      author: 'openai',
      pipelineTag: 'text-generation',
    },
    description:
      'Sparse 117B reasoning model with only ~5B parameters active per token — low/medium/high effort and tool use, fast on one GPU.',
    params: {
      engine: 'vllm',
      servedModelName: 'gpt-oss-120b',
      // 'openai_gptoss', not 'gpt_oss' — that is the key vLLM's reasoning registry uses (the TOOL
      // parser for the same harmony format is the one called 'openai'). Without it the chain of
      // thought comes back as ordinary content.
      customParams: [{ key: 'reasoning-parser', value: 'openai_gptoss' }],
      // config.json: max_position_embeddings 131072 via YaRN (factor 32 over a 4096 base window).
      maxContext: 131072,
      gpuMemoryUtilization: 0.9,
      // 'none' so vLLM reads the checkpoint's own quantization_config. The experts are MXFP4 and
      // its modules_to_not_convert keeps attention, the routers, embeddings and lm_head in bf16;
      // ModelQuantization has no 'mxfp4' member anyway, and naming one of the others would be wrong.
      quantization: 'none',
      dtype: 'auto',
      kvCacheDtype: 'auto',
      // Native vLLM architecture, no Python in the repo.
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      // harmony format. Named 'openai' in vLLM, which reads like a generic default but is not.
      toolCallParser: 'openai',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 1,
      // 65.25 GB resident (60.77 GiB): 114.66B MXFP4 expert values packed two per byte, their e8m0
      // scales at one byte per 32 values, plus 2.17B bf16 parameters. The cache barely registers —
      // of 36 layers only the 18 full-attention ones hold a real cache, at 2 x 8 kv heads x 64
      // head_dim = 36 KiB/token in bf16, so a full 131,072-token sequence is 4.5 GiB and the 18
      // sliding layers add ~5 MB at their 128-token window. A 96 GB card leaves 19.7 GiB for KV
      // (~4 max-length requests) and a 141 GB one 57.4 GiB (~12). An 80 GB card leaves 6.3 GiB
      // BEFORE activations, which will not reliably hold one full-length sequence — hence 90.
      vramGb: 90,
      // vLLM's Mxfp4Config declares min capability 80 and falls back to the Marlin kernels, which
      // keep the weights packed; Hopper and Blackwell get the Triton/FlashInfer paths instead.
      computeCapability: 8.0,
      cpu: { min: 8, recommended: 16 },
      ram: { min: 72, recommended: 104 },
      // Only the 14 top-level shards are fetched (65.25 GB) — the loader resolves `*.safetensors`
      // through the index file, which skips the identical `original/` copy and metal/model.bin.
      disk: { min: 80, recommended: 100 },
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
    description:
      'Agentic coding model with 80B total but only ~3B active parameters per token. Official FP8 weights and a native 256k context, on a single GPU.',
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
  // Code, 2 GPUs — sharded with --tensor-parallel-size 2. Needs a vLLM build carrying the qwen3_next
  // architecture; on an older image the server exits at startup with an unknown-arch error.
  {
    id: 'code-assistant-xl',
    model: {
      id: 'Qwen/Qwen3-Coder-Next',
      author: 'Qwen',
      pipelineTag: 'text-generation',
    },
    description:
      "Qwen's newest coding architecture, sharded across two GPUs. Stronger than the 30B coder on large, multi-file work.",
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
    description:
      'Frontier-grade reasoning for hard, multi-step problems. Thinks longer than the chat models, and spans two GPUs.',
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
  // Dense 128B, official FP8 checkpoint (121.8B params fp8 + 5.9B bf16 = 133.61 GB / 124.4 GiB).
  // v0.28.0 registers Mistral3ForConditionalGeneration, so no vllmTag.
  //
  // Mistral's published recipe is TP=8 at util 0.8. That is far more than the weights need — see
  // the arithmetic below — so this runs at TP=4, which still holds a full-length sequence on the
  // smallest card FP8 admits. Everything else here is the recipe verbatim.
  {
    id: 'hybrid-reasoning-chat',
    model: {
      id: 'mistralai/Mistral-Medium-3.5-128B',
      author: 'mistralai',
      pipelineTag: 'image-text-to-text',
    },
    description:
      'Dense 128B model that switches between instant replies and deep reasoning per request, reads images, and holds a 256k context across 4 GPUs.',
    params: {
      engine: 'vllm',
      servedModelName: 'mistral-medium-3.5',
      customParams: [
        // Reasoning is per-request (reasoning_effort 'none' | 'high'), so the parser must be on for
        // the 'high' path to come back as `message.reasoning` instead of inline content.
        { key: 'reasoning-parser', value: 'mistral' },
        // Both from Mistral's own vLLM command.
        { key: 'max-num-batched-tokens', value: '16384' },
        { key: 'max-num-seqs', value: '128' },
      ],
      // text_config: max_position_embeddings 262144 via YaRN (factor 64 over a 4096 base window).
      // Note the README warning: an earlier config commit degraded long-context quality — this is
      // the fixed one, so do not pin `revision`.
      maxContext: 262144,
      tensorParallelSize: 4,
      // The recipe says 0.8; 0.9 matches the rest of this catalogue and the KV pool below is sized
      // at 0.9. Drop it to 0.8 if a launch OOMs during the vision tower's warmup.
      gpuMemoryUtilization: 0.9,
      // 'none' so vLLM reads the checkpoint's own quantization_config, whose modules_to_not_convert
      // keeps the vision tower, the multimodal projector and lm_head in bf16. Naming fp8 here would
      // hand those to the fp8 path too.
      quantization: 'none',
      dtype: 'auto',
      // The recipe passes no --kv-cache-dtype. bf16 it is; fp8 would halve the figures below.
      kvCacheDtype: 'auto',
      // Native vLLM architecture, no Python in the repo.
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: true,
      toolCallParser: 'mistral',
    },
    type: 'quickstart',
    sourcePeerIds: NODE_IDS,
    requiredResources: resources({
      gpus: 4,
      // TP=4 puts 31.1 GiB of weights on each card and shards the KV heads 8 -> 2 per rank. The
      // cache is the binding constraint, not the weights: 88 layers with no sliding window, at
      // 2 x 8 kv heads x 128 head_dim in bf16, cost 352 KiB/token, so one full 262,144-token
      // sequence is 88 GiB across the four ranks. An 80 GB card (the smallest FP8 weights allow at
      // all) leaves 36.0 GiB free per rank at util 0.9 = 144 GiB of pool, i.e. one max-length
      // request plus headroom; a 141 GB card leaves 87.1 GiB per rank = 348 GiB, about four.
      vramGb: 80,
      // FP8 weights — Hopper/Ada only.
      computeCapability: 8.9,
      cpu: { min: 24, recommended: 48 },
      ram: { min: 220, recommended: 320 },
      // 133.61 GB of weights. The repo ships them twice (HF `model-*` shards AND Mistral's
      // `consolidated-*` ones, 267.25 GB together), but only one set is fetched: the loader
      // resolves `*.safetensors` through model.safetensors.index.json precisely to skip the
      // duplicates. Headroom on top is for the download's staging copy.
      disk: { min: 170, recommended: 220 },
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
    description:
      "Zhipu's flagship multimodal MoE — 320B total, 18B active per token, natively reads text, images and video, sharded across 4 GPUs.",
    params: {
      engine: 'vllm',
      // v0.28.0 (the stable fallback) doesn't recognize this architecture; vLLM's own model-specific
      // tag does.
      vllmTag: 'glm53-flash',
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
      // v0.28.0 doesn't recognize qwen4_exp. The auto-derived tag would be 'qwen38-flash-next-fp8'
      // (from the -FP8 repo id), which 404s — vLLM tags the base model name, not the quant suffix.
      vllmTag: 'qwen38-flash-next',
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
];
