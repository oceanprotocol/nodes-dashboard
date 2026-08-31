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

/** Tags users can deliberately select in the advanced vLLM runtime field. Empty = model/default routing. */
export const VLLM_TAG_OPTIONS = [
  { label: 'Automatic (recommended)', value: '' },
  { label: 'v0.28.0 (stable)', value: 'v0.28.0' },
  { label: 'qwen38-flash-next (Qwen3.8-Flash-Next)', value: 'qwen38-flash-next' },
  { label: 'glm53-flash (GLM-5.3-Flash)', value: 'glm53-flash' },
] as const;

/**
 * Curated, known-good tag values (Automatic's empty value dropped). Pinned first in the live Docker
 * Hub tag list and used as the fallback when that fetch fails — see useVllmTags. Keep this the single
 * source so the picker's curated subset and the fallback can't drift apart.
 */
export const VLLM_KNOWN_TAGS: string[] = VLLM_TAG_OPTIONS.map(({ value }) => value).filter(Boolean);

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
