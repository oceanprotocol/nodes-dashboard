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

/**
 * vLLM engine (cold) launch flags for a custom model.
 * Sampling params absent: the exposed endpoint is OpenAI-compatible, so clients send temperature/top_p/etc. on every request and override any launch defaults
 */
export type ModelParameters = {
  // Identity / integration.
  servedModelName: string;
  // Cold engine flags.
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
