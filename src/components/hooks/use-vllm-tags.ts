import { dockerHubTagExists, fetchDockerHubTags } from '@/lib/dockerhub';
import { VLLM_IMAGE } from '@/services/inference-launch';
import { useQuery } from '@tanstack/react-query';

const VLLM_RECENT_TAG_LIMIT = 10;

type VllmTagsState = {
  tags: string[];
  modelTag: string | null;
  modelTagLoading: boolean;
};

/** Convert a HF model name to the convention used by vLLM's model-specific Docker tags. */
export function vllmModelTagCandidate(modelId: string): string {
  const modelName = modelId.trim().split('/').pop()?.toLowerCase() ?? '';
  return modelName
    .replace(/\./g, '')
    .replace(/^([a-z]+)-(?=\d)/, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The newest tags plus an exact, verified model-specific tag when vLLM publishes one. */
export function useVllmTags(modelId: string, enabled: boolean): VllmTagsState {
  const candidate = vllmModelTagCandidate(modelId);
  const recentQuery = useQuery({
    queryKey: ['vllm-tags', VLLM_IMAGE, VLLM_RECENT_TAG_LIMIT],
    enabled,
    staleTime: 60 * 60 * 1000,
    queryFn: ({ signal }) => fetchDockerHubTags(VLLM_IMAGE, signal, VLLM_RECENT_TAG_LIMIT),
  });
  const modelTagQuery = useQuery({
    queryKey: ['vllm-model-tag', VLLM_IMAGE, candidate],
    enabled: enabled && !!candidate,
    staleTime: 60 * 60 * 1000,
    queryFn: ({ signal }) => dockerHubTagExists(VLLM_IMAGE, candidate, signal),
  });

  return {
    tags: recentQuery.data ?? [],
    modelTag: modelTagQuery.data ? candidate : null,
    modelTagLoading: modelTagQuery.isFetching && modelTagQuery.data === undefined,
  };
}
