import { CustomParam, ToolCallParser } from '@/types/huggingface';

/**
 * Launch flags that differ from the generic vLLM defaults for a specific Hugging Face model. Image
 * tags are deliberately not kept here: the dashboard derives and verifies those at runtime.
 */
export type VllmModelPreset = {
  tensorParallelSize: number;
  toolCalling: boolean;
  toolCallParser: ToolCallParser;
  customParams: CustomParam[];
};

const VLLM_MODEL_PRESETS: Record<string, VllmModelPreset> = {
  'qwen/qwen3.8-flash-next': {
    tensorParallelSize: 4,
    toolCalling: true,
    toolCallParser: 'qwen3_xml',
    customParams: [
      { key: 'reasoning-parser', value: 'qwen3' },
      { key: 'max-num-seqs', value: '256' },
      { key: 'enable-prefix-caching', value: '' },
      { key: 'no-enable-flashinfer-autotune', value: '' },
    ],
  },
  'zai-org/glm-5.3-flash': {
    tensorParallelSize: 4,
    toolCalling: true,
    toolCallParser: 'glm47',
    customParams: [{ key: 'reasoning-parser', value: 'glm45' }],
  },
};

/** Return model-specific vLLM launch flags, if this model needs any. */
export function getVllmModelPreset(modelId: string): VllmModelPreset | null {
  return VLLM_MODEL_PRESETS[modelId.trim().toLowerCase()] ?? null;
}
