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

/** A user-defined launch parameter — an arbitrary key/value pair, like a Vercel env var. */
export type CustomParam = {
  key: string;
  value: string;
};

/**
 * Launch-time configuration for a custom model, in two groups:
 *
 * 1. Custom parameters — arbitrary key/value pairs the user adds (like env vars). No fixed schema or
 *    validation beyond non-empty, unique keys; any param can be set on any model.
 * 2. vLLM engine (cold) flags — how the server loads and runs the model. Fixed at launch.
 */
export type ModelParameters = {
  // Identity / integration.
  servedModelName: string;

  // Arbitrary user-defined key/value params (like env vars).
  customParams: CustomParam[];

  // Cold engine flags (vLLM-specific).
  // Optional: null = don't emit --max-model-len, let vLLM derive the context length from the model
  // config at launch. A number pins it explicitly.
  maxContext: number | null;
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
