/** Model-derived engine defaults pulled from HF config.json + tokenizer_config.json. */
export type HuggingFaceModelConfig = {
  architecture: string | null;
  modelType: string | null;
  maxContext: number | null;
  torchDtype: string | null;
  quantizationMethod: string | null;
  /** True when the model's chat template references tools — a prerequisite for vLLM tool calling. */
  supportsTools: boolean;
  /** Recommended generation defaults shipped by the model in generation_config.json (null when absent). */
  generation: ModelGenerationDefaults;
};

/** Sampling defaults a model ships in generation_config.json. Any field is null when the model omits it. */
export type ModelGenerationDefaults = {
  temperature: number | null;
  topP: number | null;
  topK: number | null;
  repetitionPenalty: number | null;
};

export type ModelQuantization = 'none' | 'fp8' | 'awq' | 'gptq';
export type ModelDtype = 'auto' | 'bfloat16' | 'float16' | 'float32';
export type KvCacheDtype = 'auto' | 'fp8';

/** vLLM `--tool-call-parser` values. No default — the user must pick the one matching the model family. */
export type ToolCallParser =
  | 'hermes'
  | 'llama3_json'
  | 'llama4_json'
  | 'mistral'
  | 'granite'
  | 'granite-20b-fc'
  | 'internlm'
  | 'jamba'
  | 'deepseek_v3'
  | 'pythonic';

/**
 * Launch-time configuration for a custom model, in two groups:
 *
 * 1. Generation defaults — sampling behaviour the model is served with. The endpoint is
 *    OpenAI-compatible, so clients may send temperature/top_p/etc. per request and those win; these
 *    values are the server defaults applied whenever a request omits them (vLLM
 *    `--override-generation-config`). Seeded from the model's own generation_config.json.
 * 2. vLLM engine (cold) flags — how the server loads and runs the model. Fixed at launch.
 */
export type ModelParameters = {
  // Identity / integration.
  servedModelName: string;

  // Generation defaults (model-specific sampling — used when a request doesn't override them).
  temperature: number;
  topP: number;
  /** -1 disables top-k (consider all tokens). */
  topK: number;
  repetitionPenalty: number;

  // Cold engine flags (vLLM-specific).
  maxContext: number;
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
