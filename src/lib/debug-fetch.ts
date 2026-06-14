// TEMP DIAGNOSTIC: wraps window.fetch to log all requests/responses to Privy and Alchemy
// endpoints, so we can see exactly what the auth/migration SDKs send and receive (e.g. the
// "Wallet already exists" import error). Remove once login/migration is debugged.

const SENSITIVE_KEYS = ['ciphertext', 'encapsulatedKey', 'encryption_public_key', 'encryptionPublicKey', 'privateKey', 'private_key', 'signature', 'token', 'accessToken'];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.includes(k) ? '«redacted»' : redact(v);
    }
    return out;
  }
  return value;
}

let installed = false;

export function installPrivyAlchemyFetchLogger(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isTarget = /privy\.io|alchemy\.com|alchemyapi\.io|g\.alchemy\.com/.test(url);

    if (!isTarget) return origFetch(input, init);

    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET') ?? 'GET').toUpperCase();

    let reqBody: unknown;
    try {
      if (typeof init?.body === 'string') reqBody = redact(JSON.parse(init.body));
    } catch {
      reqBody = '«non-json body»';
    }

    console.log('[net→]', method, url, reqBody ?? '');

    try {
      const res = await origFetch(input, init);
      let body: unknown;
      try {
        body = await res.clone().json();
      } catch {
        try {
          body = await res.clone().text();
        } catch {
          body = '«unreadable body»';
        }
      }
      const tag = res.ok ? '[net←]' : '[net✗]';
      console.log(tag, res.status, method, url, redact(body));
      return res;
    } catch (err) {
      console.log('[net✗]', 'NETWORK_ERROR', method, url, err);
      throw err;
    }
  };
}
