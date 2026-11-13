/**
 * A url only survives this if it parses and is http(s) — everything else (`javascript:`, `data:`,
 * custom protocol handlers, relative junk) comes back undefined so it never reaches an `href`, a
 * copy button or a code snippet. Parsing rather than prefix matching, so leading whitespace, odd
 * casing and embedded tabs can't smuggle a scheme through.
 *
 * Returns the input string, not `url.href`: `href` appends a trailing slash to a bare origin, and
 * callers join paths onto the result (`${baseUrl}/docs`, `/v1`, `/mcp`).
 */
export const safeHttpUrl = (raw?: string | null): string | undefined => {
  if (!raw) {
    return undefined;
  }
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:' ? raw : undefined;
  } catch {
    return undefined;
  }
};
