import type { NextApiRequest, NextApiResponse } from 'next';

// 256kb instead of Next's 1mb default because a full batch from the app is a few kilobytes, and
// whatever this route accepts is forwarded to the metered upstream.
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };

// 100 because that is ethers' default batchMaxCount, so a larger batch never comes from the app.
const MAX_BATCH = 100;

const ALLOWED_METHODS = new Set([
  'eth_call',
  'eth_getBalance',
  // Tells a deployed smart account from a counterfactual one before signing.
  'eth_getCode',
  'eth_chainId',
  'eth_blockNumber',
  // Block timestamps for escrow and subsidy history.
  'eth_getBlockByNumber',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_feeHistory',
  'eth_maxPriorityFeePerGas',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_accounts',
  'net_version',
]);

// Capped at two because the optional third param (state overrides) makes a call much heavier
// upstream, and the app never sends one.
const MAX_PARAMS: Partial<Record<string, number>> = { eth_call: 2, eth_estimateGas: 2 };

type RpcRequest = { method: string; params?: unknown[] };

// The body is client-supplied, so each element's shape is checked before its fields are read; a
// malformed element should get a 400, not throw.
function isRpcRequest(value: unknown): value is RpcRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { method, params } = value as { method?: unknown; params?: unknown };
  return typeof method === 'string' && (params === undefined || Array.isArray(params));
}

function getOriginHost(req: NextApiRequest): string | null {
  const origin = req.headers.origin ?? req.headers.referer;
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appHost = req.headers.host?.split(':')[0];
  const originHost = getOriginHost(req);
  if (!originHost || originHost !== appHost) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body: unknown = req.body;
  if (Array.isArray(body) && body.length === 0) {
    return res.status(400).json({ error: 'Empty batch' });
  }
  const requests: unknown[] = Array.isArray(body) ? body : [body];
  if (requests.length > MAX_BATCH) {
    return res.status(413).json({ error: `Batch too large (max ${MAX_BATCH})` });
  }

  for (const rpcReq of requests) {
    if (!isRpcRequest(rpcReq)) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    if (!ALLOWED_METHODS.has(rpcReq.method)) {
      return res.status(403).json({ error: `Method not allowed: ${rpcReq.method}` });
    }
    const maxParams = MAX_PARAMS[rpcReq.method];
    if (maxParams !== undefined && (rpcReq.params?.length ?? 0) > maxParams) {
      return res.status(400).json({ error: `Too many params for ${rpcReq.method}` });
    }
  }

  const alchemyUrl = process.env.ALCHEMY_RPC_URL;
  if (!alchemyUrl) {
    return res.status(500).json({ error: 'RPC not configured' });
  }

  try {
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[rpc proxy] upstream error:', err);
    return res.status(502).json({ error: 'Bad gateway' });
  }
}
