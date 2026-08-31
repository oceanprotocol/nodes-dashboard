import axios from 'axios';

type DockerHubTagsResponse = {
  results?: { name: string }[];
};

// Fetch tag names for a public Docker Hub repo (`namespace/repo`). Goes through our own /api/docker-tags
// route: Docker Hub's hub.docker.com/v2 API sends no Access-Control-Allow-Origin, so a direct browser
// fetch is CORS-blocked (200 but unreadable) — the proxy fetches it server-side and returns same-origin
// JSON. Throws on network / non-200 / rate-limit failure so callers can fall back to a known tag list.
export async function fetchDockerHubTags(repo: string, signal?: AbortSignal): Promise<string[]> {
  const url = `/api/docker-tags?repo=${encodeURIComponent(repo)}`;
  const { data } = await axios.get<DockerHubTagsResponse & { tags?: string[] }>(url, { signal });
  if (data.tags) return data.tags.filter(Boolean);
  return (data.results ?? []).map((result) => result.name).filter(Boolean);
}

// Order fetched tags for display: the image's pinned `knownTags` first (only those actually present),
// then every other fetched tag in Docker Hub's order (most-recently-pushed first). Dedupes.
export function orderTags(fetched: string[], knownTags: string[]): string[] {
  const present = new Set(fetched);
  const pinned = knownTags.filter((tag) => present.has(tag));
  const rest = fetched.filter((tag) => !knownTags.includes(tag));
  return [...pinned, ...rest];
}
