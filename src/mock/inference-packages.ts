import { getSupportedTokens } from '@/constants/tokens';
import { InferencePackage } from '@/types/inference';

/**
 * Curated quick-start packages. MOCK DATA — the backend doesn't serve packages yet; swap
 * fetchInferencePackages for the real API call when it lands. Model ids are real, ungated Hugging
 * Face repos so URL hydration (which re-fetches models by id on a hard reload) works.
 *
 * Each package pins a concrete environment by id (peer + env prefix + per-type GPU selection) —
 * the same selection the custom flow commits, but hardcoded. The live env is resolved from the
 * environments API at selection time. The pinned envs below are real Base-chain service nodes
 * (H200 pool); repoint them if the fleet changes.
 */
const USDC = getSupportedTokens().USDC.address;

// A node advertising 8× H200, service-on-demand capable.
const NODE_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi';
const NODE_ENV_ID_PREFIX = '0xff1004b67de08fc505fbf0a2089010d0f23015338c7def8557697513c4a39935';

const INFERENCE_PACKAGES: InferencePackage[] = [
  {
    id: 'everyday-chat',
    model: {
      id: 'Qwen/Qwen2.5-7B-Instruct',
      author: 'Qwen',
      pipelineTag: 'text-generation',
      gated: false,
    },
    params: {
      servedModelName: 'qwen2.5-7b-instruct',
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
      toolCallParser: 'hermes',
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
      tokenAddress: USDC,
    },
  },
  {
    id: 'code-assistant',
    model: {
      id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
      author: 'Qwen',
      pipelineTag: 'text-generation',
      gated: false,
    },
    params: {
      servedModelName: 'qwen2.5-coder-7b-instruct',
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
      toolCallParser: 'hermes',
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
      tokenAddress: USDC,
    },
  },
  {
    id: 'deep-reasoning',
    model: {
      id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
      author: 'deepseek-ai',
      pipelineTag: 'text-generation',
      gated: false,
    },
    params: {
      servedModelName: 'r1-distill-qwen-7b',
      customParams: [],
      maxContext: 32768,
      gpuMemoryUtilization: 0.9,
      quantization: 'none',
      dtype: 'auto',
      kvCacheDtype: 'auto',
      trustRemoteCode: false,
      enforceEager: false,
      revision: '',
      toolCalling: false,
      toolCallParser: null,
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
      tokenAddress: USDC,
    },
  },
  {
    id: 'light-and-fast',
    model: {
      id: 'microsoft/Phi-3.5-mini-instruct',
      author: 'microsoft',
      pipelineTag: 'text-generation',
      gated: false,
    },
    params: {
      servedModelName: 'phi-3.5-mini-instruct',
      customParams: [],
      maxContext: 16384,
      gpuMemoryUtilization: 0.85,
      quantization: 'none',
      dtype: 'auto',
      kvCacheDtype: 'auto',
      trustRemoteCode: true,
      enforceEager: false,
      revision: '',
      toolCalling: false,
      toolCallParser: null,
    },
    env: {
      peerId: NODE_ID,
      envIdPrefix: NODE_ENV_ID_PREFIX,
      gpuSelection: { 'NVIDIA Tesla T4': 1 },
      tokenAddress: USDC,
    },
  },
];

const MOCK_FETCH_DELAY_MS = 300;

/** Mimics the eventual packages API: resolves the curated list after a short delay. */
export async function fetchInferencePackages(): Promise<InferencePackage[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_FETCH_DELAY_MS));
  return INFERENCE_PACKAGES;
}
