import { fetchDockerHubTags, orderTags } from '@/lib/dockerhub';
import { VLLM_IMAGE } from '@/services/inference-launch';
import { VLLM_KNOWN_TAGS } from '@/services/vllm-model-presets';
import { useQuery } from '@tanstack/react-query';

type VllmTagsState = {
  /** Curated known tags pinned first, then every other published tag (most-recent first). */
  tags: string[];
  loading: boolean;
};

export function useVllmTags(): VllmTagsState {
  const { data, isFetching } = useQuery({
    queryKey: ['vllm-tags', VLLM_IMAGE],
    staleTime: 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const fetched = await fetchDockerHubTags(VLLM_IMAGE, signal);
      const ordered = orderTags(fetched, VLLM_KNOWN_TAGS);
      return ordered.length > 0 ? ordered : VLLM_KNOWN_TAGS;
    },
  });

  return { tags: data ?? VLLM_KNOWN_TAGS, loading: isFetching && !data };
}
