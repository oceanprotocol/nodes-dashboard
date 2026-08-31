import { dockerHubTagExists } from '@/lib/dockerhub';
import { VLLM_IMAGE } from '@/services/inference-launch';
import { useQuery } from '@tanstack/react-query';

type VllmModelTagState = {
  modelTag: string | null;
  loading: boolean;
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

/** Return an exact model-specific tag only after verifying that vLLM publishes it. */
export function useVllmModelTag(modelId: string, enabled: boolean): VllmModelTagState {
  const candidate = vllmModelTagCandidate(modelId);
  const query = useQuery({
    queryKey: ['vllm-model-tag', VLLM_IMAGE, candidate],
    enabled: enabled && !!candidate,
    staleTime: 60 * 60 * 1000,
    queryFn: ({ signal }) => dockerHubTagExists(VLLM_IMAGE, candidate, signal),
  });

  return {
    modelTag: query.data ? candidate : null,
    loading: query.isFetching && query.data === undefined,
  };
}
