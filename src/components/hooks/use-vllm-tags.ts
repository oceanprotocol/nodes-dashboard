import { fetchDockerHubTags } from '@/lib/dockerhub';
import { VLLM_IMAGE } from '@/services/inference-launch';
import { useQuery } from '@tanstack/react-query';

// Fetch the full page (Docker Hub's max) because clean release tags are sparse among the noise:
// the newest tags are almost all nightly/commit-sha/arch variants (`nightly-<sha>`, `*-aarch64`,
// `cu129-nightly`), and there may be only two `vX.Y.Z` releases in the first hundred results.
const VLLM_TAG_FETCH_LIMIT = 100;
// Only stable release tags are offered as manual overrides. A nightly or arch-specific tag picked by
// hand fails at vLLM startup — inside the paid window — so they never reach the runtime dropdown.
const VLLM_RELEASE_TAG_RE = /^v\d+\.\d+\.\d+$/;
// A short list is the point: Automatic and the model-required preset cover the common cases; these
// are the escape hatch for pinning a known release, not a full tag browser.
const VLLM_RELEASE_TAG_LIMIT = 3;

/** The newest stable `vX.Y.Z` release tags for the vLLM image, cached image-wide for one hour. */
export function useVllmTags(enabled: boolean): string[] {
  const { data } = useQuery({
    queryKey: ['vllm-tags', VLLM_IMAGE, VLLM_TAG_FETCH_LIMIT],
    enabled,
    staleTime: 60 * 60 * 1000,
    queryFn: ({ signal }) => fetchDockerHubTags(VLLM_IMAGE, signal, VLLM_TAG_FETCH_LIMIT),
  });

  return (data ?? []).filter((tag) => VLLM_RELEASE_TAG_RE.test(tag)).slice(0, VLLM_RELEASE_TAG_LIMIT);
}
