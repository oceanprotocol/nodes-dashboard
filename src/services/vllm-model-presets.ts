import { CustomParam, ToolCallParser } from '@/types/huggingface';

/**
 * Launch settings that differ from the generic stable vLLM runtime for a specific Hugging Face
 * model. These models use architectures that landed after the current stable vLLM release, so the
 * official model-specific image is required until the support ships in a stable release.
 */
export type VllmModelPreset = {
  imageTag: string;
  tensorParallelSize: number;
  toolCalling: boolean;
  toolCallParser: ToolCallParser;
  customParams: CustomParam[];
};

const VLLM_MODEL_PRESETS: Record<string, VllmModelPreset> = {
  'qwen/qwen3.8-flash-next': {
    imageTag: 'qwen38-flash-next',
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
    imageTag: 'glm53-flash',
    tensorParallelSize: 4,
    toolCalling: true,
    toolCallParser: 'glm47',
    customParams: [{ key: 'reasoning-parser', value: 'glm45' }],
  },
};

/** Return the official vLLM launch preset for a model id, if it needs one. */
export function getVllmModelPreset(modelId: string): VllmModelPreset | null {
  return VLLM_MODEL_PRESETS[modelId.trim().toLowerCase()] ?? null;
}
