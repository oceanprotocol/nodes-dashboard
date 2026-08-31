import { fetchDockerHubTags, orderTags } from '@/lib/dockerhub';
import { VLLM_IMAGE } from '@/services/inference-launch';
import { VLLM_KNOWN_TAGS } from '@/services/vllm-model-presets';
import { useQuery } from '@tanstack/react-query';

type VllmTagsState = {
  /** Curated known tags pinned first, then every other published tag (most-recent first). */
  tags: string[];
  loading: boolean;
};

/**
 * Live tag list for the vLLM image from Docker Hub, curated VLLM_KNOWN_TAGS pinned first.
 *
 * Gated by `enabled`: the runtime picker defaults to the curated subset and only fetches the full list
 * when the user expands "show all", so most sessions never hit Docker Hub. The tag list is a property
 * of the image, not the selected model, so it's cached image-wide (one query key) and reused across
 * models. Falls back to VLLM_KNOWN_TAGS on any failure (CORS / network / rate limit) — the picker is
 * never left empty.
 */
export function useVllmTags(enabled: boolean): VllmTagsState {
  const { data, isFetching } = useQuery({
    queryKey: ['vllm-tags', VLLM_IMAGE],
    enabled,
    staleTime: 60 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const fetched = await fetchDockerHubTags(VLLM_IMAGE, signal);
      const ordered = orderTags(fetched, VLLM_KNOWN_TAGS);
      return ordered.length > 0 ? ordered : VLLM_KNOWN_TAGS;
    },
  });

  return { tags: data ?? VLLM_KNOWN_TAGS, loading: enabled && isFetching && !data };
}
