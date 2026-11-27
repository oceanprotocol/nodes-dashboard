/**
 * For URLs that come from nodes, which are untrusted: only http(s) is safe to put in an `href` or offer
 * for copying. Parsed with `URL` rather than prefix-matched because browsers ignore leading whitespace,
 * case and embedded tabs in a scheme, so a string check can be bypassed.
 *
 * Returns the input, not `url.href`, because `href` adds a trailing slash to a bare origin and callers
 * append paths (`${baseUrl}/docs`). The result is not safe for a shell; quote it with `shellQuote`.
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
