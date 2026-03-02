const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'https://ocean-proxy.oceanprotocol.com';

export async function proxyFetch(targetUrl: string, options?: RequestInit): Promise<Response> {
  // Try to fetch from the proxy
  try {
    const response = await fetch(PROXY_URL, {
      ...options,
      headers: {
        ...options?.headers,
        'X-Target-URL': targetUrl,
      },
    });

    if (!response.ok && response.status >= 500) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    return response;
  } catch (error) {
    // Fallback to direct fetch
    console.warn('Proxy failed, falling back to direct fetch:', error);
    return fetch(targetUrl, options);
  }
}
