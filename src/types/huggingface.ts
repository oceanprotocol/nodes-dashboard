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

/** vLLM `--tool-call-parser` values. No default — the user must pick the one matching the model family. */
export type ToolCallParser =
  | 'openai'
  | 'hermes'
  | 'llama3_json'
  | 'llama4_json'
  | 'mistral'
  | 'granite'
  | 'granite-20b-fc'
  | 'internlm'
  | 'jamba'
  | 'deepseek_v3'
  | 'qwen3_coder'
  | 'pythonic';

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
};
