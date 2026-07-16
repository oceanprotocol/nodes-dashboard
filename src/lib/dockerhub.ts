import axios from 'axios';

type DockerHubTagsResponse = {
  results?: { name: string }[];
};

// Fetch tag names for a public Docker Hub repo (`namespace/repo`). This is a public GET endpoint that
// is CORS-open for browsers. Throws on network / CORS / rate-limit failure so callers can fall back
// to a known tag list.
export async function fetchDockerHubTags(repo: string, signal?: AbortSignal): Promise<string[]> {
  const url = `https://hub.docker.com/v2/repositories/${repo}/tags?page_size=100`;
  const { data } = await axios.get<DockerHubTagsResponse>(url, { signal });
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
