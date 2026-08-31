import { fetchDockerHubTags } from '@/lib/dockerhub';
import { VLLM_IMAGE } from '@/services/inference-launch';
import { useQuery } from '@tanstack/react-query';

const VLLM_RECENT_TAG_LIMIT = 10;

/** The newest published tags for the vLLM image, cached image-wide for one hour. */
export function useVllmTags(enabled: boolean): string[] {
  const { data } = useQuery({
    queryKey: ['vllm-tags', VLLM_IMAGE, VLLM_RECENT_TAG_LIMIT],
    enabled,
    staleTime: 60 * 60 * 1000,
    queryFn: ({ signal }) => fetchDockerHubTags(VLLM_IMAGE, signal, VLLM_RECENT_TAG_LIMIT),
  });

  return data ?? [];
}
