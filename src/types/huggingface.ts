/** Model-derived engine defaults pulled from HF config.json + tokenizer_config.json. */
export type HuggingFaceModelConfig = {
  architecture: string | null;
  modelType: string | null;
  maxContext: number | null;
  torchDtype: string | null;
  quantizationMethod: string | null;
  /** True when the model's chat template references tools — a prerequisite for vLLM tool calling. */
  supportsTools: boolean;
};

export type ModelQuantization = 'none' | 'fp8' | 'awq' | 'gptq';
export type ModelDtype = 'auto' | 'bfloat16' | 'float16' | 'float32';
export type KvCacheDtype = 'auto' | 'fp8';

/**
 * vLLM `--tool-call-parser` values — the single source for both the type and the picker's options.
 * No default: the user must pick the one matching the model family, or tool calls fail to parse at
 * runtime. Names come from vLLM's `ToolParserManager` registry
 * (`vllm/tool_parsers/__init__.py`, `_TOOL_PARSERS_TO_REGISTER`); this is the subset relevant to
 * models Ocean nodes realistically serve, not the full 46. vLLM adds parsers most releases and
 * `VLLM_TAG` defaults to `latest`, so the running engine may know names absent here — hence
 * `ToolCallParser` stays assignable from any string (see below).
 */
export const TOOL_CALL_PARSERS = [
  // Qwen — the most-served family here, and the easiest to get wrong: Qwen3 switched to an XML
  // format Hermes mis-parses, and the Coder variants use their own parser again.
  { label: 'qwen3_xml — Qwen3 / Qwen3.x chat', value: 'qwen3_xml' },
  { label: 'qwen3_coder — Qwen3-Coder', value: 'qwen3_coder' },
  { label: 'hermes — Qwen2.x, NousResearch Hermes', value: 'hermes' },
  // gpt-oss: harmony format. Named `openai` in vLLM, which reads like a generic default but is not.
  { label: 'openai — gpt-oss (harmony)', value: 'openai' },
  { label: 'llama3_json — Llama 3.x', value: 'llama3_json' },
  { label: 'llama4_json — Llama 4', value: 'llama4_json' },
  { label: 'llama4_pythonic — Llama 4 (pythonic)', value: 'llama4_pythonic' },
  { label: 'deepseek_v32 — DeepSeek V3.2', value: 'deepseek_v32' },
  { label: 'deepseek_v31 — DeepSeek V3.1', value: 'deepseek_v31' },
  { label: 'deepseek_v3 — DeepSeek V3 / V4', value: 'deepseek_v3' },
  { label: 'mistral — Mistral, Mixtral, Ministral', value: 'mistral' },
  { label: 'glm45 — GLM-4.5 / 4.6 / 4.7', value: 'glm45' },
  { label: 'kimi_k2 — Moonshot Kimi K2', value: 'kimi_k2' },
  { label: 'minimax_m2 — MiniMax M2', value: 'minimax_m2' },
  { label: 'gemma4 — Gemma 3 / 4', value: 'gemma4' },
  { label: 'phi4_mini_json — Phi-4-mini', value: 'phi4_mini_json' },
  { label: 'seed_oss — ByteDance Seed-OSS', value: 'seed_oss' },
  { label: 'granite4 — IBM Granite 4', value: 'granite4' },
  { label: 'granite — IBM Granite 3.x', value: 'granite' },
  { label: 'granite-20b-fc — IBM Granite 20B FC', value: 'granite-20b-fc' },
  { label: 'hunyuan_a13b — Tencent Hunyuan A13B', value: 'hunyuan_a13b' },
  { label: 'step3 — StepFun Step 3', value: 'step3' },
  { label: 'longcat — Meituan LongCat', value: 'longcat' },
  { label: 'olmo3 — AI2 OLMo 3', value: 'olmo3' },
  { label: 'internlm — InternLM2', value: 'internlm' },
  { label: 'jamba — AI21 Jamba', value: 'jamba' },
  { label: 'xlam — Salesforce xLAM', value: 'xlam' },
  // Format-generic, not family-specific — the fallbacks when nothing above matches.
  { label: 'pythonic — generic Python-call format', value: 'pythonic' },
] as const;

/** The parser names we ship options for — use this where an exhaustive check is wanted. */
export type KnownToolCallParser = (typeof TOOL_CALL_PARSERS)[number]['value'];

/**
 * A parser name. Known values autocomplete; any other string is still accepted, so a parser added by
 * a newer vLLM than this list knows about survives a round-trip through the form and the launch
 * command instead of being silently dropped.
 */
export type ToolCallParser = KnownToolCallParser | (string & {});

/**
 * A user-defined launch flag — an arbitrary key/value pair appended to the engine's launch command
 * as `--<key> <value>` (bare `--<key>` when the value is empty). Keys may be written with or without
 * their leading dashes.
 */
export type CustomParam = {
  key: string;
  value: string;
};

/**
 * The inference server a model runs on. Each engine ships a different container image, listens on a
 * different port and takes a different launch command, so the choice drives both the params the user
 * edits (see the two branches of ModelParameters) and how the launch command is built.
 * - `vllm`     — vllm/vllm-openai, CUDA GPU, serves the raw HF weights. The rich-flag default.
 * - `llamacpp` — ghcr.io/ggml-org/llama.cpp, CPU-capable, serves a GGUF quantization off the Hub.
 */
export type InferenceEngine = 'vllm' | 'llamacpp';

/** Fields every engine shares — identity + arbitrary user-defined launch flags. */
type CommonModelParameters = {
  /** The name the running model answers to (`--served-model-name` / `--alias`); clients address it by this. */
  servedModelName: string;
  /**
   * Arbitrary user-defined launch flags, appended to the engine command after the flags the form
   * builds — so a custom param naming the same flag overrides the form's value (last one wins).
   */
  customParams: CustomParam[];
};

/**
 * vLLM cold-launch flags — how the server loads and runs the raw Hugging Face weights. Fixed at
 * launch; changing them needs a restart.
 */
export type VllmParameters = CommonModelParameters & {
  engine: 'vllm';
  // Optional: null = don't emit --max-model-len, let vLLM derive the context length from the model
  // config at launch. A number pins it explicitly.
  maxContext: number | null;
  /**
   * Number of GPUs to shard the model across (`--tensor-parallel-size`). 1 (or null) = single GPU,
   * flag omitted. Must match the GPU count the package books, or vLLM either OOMs (booked fewer than
   * it shards across) or leaves GPUs idle.
   */
  tensorParallelSize?: number | null;
  gpuMemoryUtilization: number;
  quantization: ModelQuantization;
  dtype: ModelDtype;
  kvCacheDtype: KvCacheDtype;
  trustRemoteCode: boolean;
  enforceEager: boolean;
  revision: string;
  toolCalling: boolean;
  toolCallParser: ToolCallParser | null;
};

/**
 * llama.cpp cold-launch flags. Unlike vLLM it serves a pre-quantized GGUF, pulled from the Hub by
 * `-hf <repo>:<quant>` — so the repo (a `*-GGUF` repo) and the quantization tag are their own fields,
 * distinct from the HF model id the picker returns.
 */
export type LlamaCppParameters = CommonModelParameters & {
  engine: 'llamacpp';
  /** GGUF repo on the Hub, e.g. `bartowski/phi-4-GGUF` — the `-hf` value before the `:` quant tag. */
  ggufRepo: string;
  /** Quantization tag within the repo, e.g. `Q4_K_M` — the part after the `:` in `-hf repo:quant`. */
  ggufQuant: string;
  /** Context window (`-c`); null lets llama.cpp use the model's trained default. */
  contextLength: number | null;
  /** GPU layers to offload (`-ngl`); 0 = pure CPU. Higher = more on GPU (needs a CUDA build/host). */
  gpuLayers: number;
  /** Enable Jinja chat templates (`--jinja`) — required for the model's tool/chat formatting. */
  jinja: boolean;
};

/**
 * Launch-time configuration for a model, discriminated by `engine`. Both branches share the identity
 * + custom-param fields (CommonModelParameters); the rest are engine-specific cold flags. The UI
 * renders the branch matching the picked engine, and buildEngineCommand dispatches on it.
 */
export type ModelParameters = VllmParameters | LlamaCppParameters;

export type HuggingFaceModel = {
  id: string;
  author?: string;
  lastModified?: string;
  likes?: number;
  downloads?: number;
  trendingScore?: number;
  pipelineTag?: string;
  tags?: string[];
  libraryName?: string;
  gated?: boolean | string;
  /**
   * Total parameter count from the repo's safetensors index. Undefined when HF hasn't indexed the
   * weights — GGUF-only repos never have it — so it means "unknown", not "zero".
   */
  paramCount?: number;
};
