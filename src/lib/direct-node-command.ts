import { NODE_URL } from '@/lib/constants';

export async function directNodeCommand({
  command,
  body,
  multiaddrs,
  peerId,
}: {
  command: string;
  body: any;
  multiaddrs?: string[];
  peerId: string;
}): Promise<Response> {
  const buildBody = (withMultiaddrs: boolean) =>
    JSON.stringify({
      command,
      node: peerId,
      ...(withMultiaddrs && multiaddrs?.length ? { multiaddrs } : {}),
      ...body,
    });
  try {
    if (multiaddrs?.length) {
      const response = await fetch(`${NODE_URL}/directCommand`, {
        method: 'POST',
        body: buildBody(true),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        return response;
      }
    }
    // fallback without multiaddrs
    const response = await fetch(`${NODE_URL}/directCommand`, {
      method: 'POST',
      body: buildBody(false),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok && response.status >= 500) {
      throw new Error(`Gateway node error: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error('Gateway node failed, falling back to direct fetch:', error);
    throw new Error(`Gateway node error: ${error}`);
  }
}

/** A command that reached the gateway and came back refused — `status` is the HTTP status the
 * gateway answered with (its own, or the target node's, piped through). */
export class NodeCommandError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'NodeCommandError';
  }
}

/**
 * One-shot gateway command that expects a JSON body back, with the failure preserved.
 *
 * ocean-node pipes the target node's stream through verbatim, so a success is HTTP 200 + raw JSON
 * with no content-type header, while every failure is a PLAIN TEXT body:
 *   400 `Invalid or unrecognized command: "…"` — the GATEWAY itself predates the command
 *   404 `Cannot open a command stream to peer …` — the peer is unreachable
 *   501 `No handler found for command: …` — the TARGET node predates the command
 *   503 — the feature is disabled node-side (e.g. node metrics history)
 *   403/429 — rate limited
 * `directNodeCommand` above collapses all of those (it throws `Gateway node error: <status>` for
 * anything >= 500 and drops the body), which is why this exists: read text() first, branch on `ok`,
 * then parse. It also threads an AbortSignal, so `withTimeout` actually cancels the fetch.
 */
export async function directNodeCommandJson<T>({
  body,
  command,
  label,
  multiaddrs,
  peerId,
  signal,
}: {
  body?: Record<string, unknown>;
  command: string;
  /** Prefix for a synthesised message when the node answers with an empty body. */
  label: string;
  multiaddrs?: string[];
  peerId: string;
  signal?: AbortSignal;
}): Promise<T> {
  const response = await fetch(`${NODE_URL}/directCommand`, {
    body: JSON.stringify({
      command,
      node: peerId,
      // Capital A on purpose: ocean-node's remote branch destructures `multiAddrs`
      // (components/httpRoutes/commands.ts). The lowercase `multiaddrs` that `directNodeCommand`
      // sends is silently dropped, which forces the gateway into a DHT lookup for every peer.
      ...(multiaddrs?.length ? { multiAddrs: multiaddrs } : {}),
      ...body,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
    signal,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new NodeCommandError(response.status, text.trim() || `${label} failed (${response.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new NodeCommandError(response.status, `${label}: the node returned a non-JSON body`);
  }
}
