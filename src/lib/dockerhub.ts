import axios from 'axios';

type DockerHubTagsResponse = {
  tags?: string[];
};

type DockerHubTagExistsResponse = {
  exists?: boolean;
};

// Fetch tag names for a public Docker Hub repo (`namespace/repo`). Goes through our own /api/docker-tags
// route: Docker Hub's hub.docker.com/v2 API sends no Access-Control-Allow-Origin, so a direct browser
// fetch is CORS-blocked (200 but unreadable) — the proxy fetches it server-side and returns same-origin
// JSON. Throws on network / non-200 / rate-limit failure so callers can fall back to a known tag list.
export async function fetchDockerHubTags(repo: string, signal?: AbortSignal, limit?: number): Promise<string[]> {
  const { data } = await axios.get<DockerHubTagsResponse>('/api/docker-tags', {
    params: { repo, limit },
    signal,
  });
  return (data.tags ?? []).filter(Boolean);
}

/** Check one exact public Docker Hub tag through the same-origin proxy. */
export async function dockerHubTagExists(repo: string, tag: string, signal?: AbortSignal): Promise<boolean> {
  const { data } = await axios.get<DockerHubTagExistsResponse>('/api/docker-tags', {
    params: { repo, tag },
    signal,
  });
  return data.exists === true;
}

// Order fetched tags for display: the image's pinned `knownTags` first (only those actually present),
// then every other fetched tag in Docker Hub's order (most-recently-pushed first). Dedupes.
export function orderTags(fetched: string[], knownTags: string[]): string[] {
  const present = new Set(fetched);
  const pinned = knownTags.filter((tag) => present.has(tag));
  const rest = fetched.filter((tag) => !knownTags.includes(tag));
  return [...pinned, ...rest];
}
