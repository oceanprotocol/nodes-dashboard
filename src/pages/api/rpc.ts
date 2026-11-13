import type { NextApiRequest, NextApiResponse } from 'next';

// Next's default body limit is 1mb. A full batch of 100 calls is a few kilobytes, so 256kb leaves
// room while bounding what one request can make this route buffer and forward upstream.
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };

// ethers' JsonRpcProvider never sends more than its default batchMaxCount of 100 calls in one
// request, so a bigger batch cannot come from the app.
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

// eth_call and eth_estimateGas take an optional third param, a state-override set that runs the
// call against fabricated balances or code. Nothing in the app sends one (ethers' `provider.call`
// is only ever given a transaction), so it is extra surface — heavier upstream work, odd error
// paths — and is rejected.
const MAX_PARAMS: Partial<Record<string, number>> = { eth_call: 2, eth_estimateGas: 2 };

type RpcRequest = { method: string; params?: unknown[] };

/** A JSON-RPC request object: `method` is a string and `params`, when present, is an array. */
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
