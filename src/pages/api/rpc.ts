import type { NextApiRequest, NextApiResponse } from 'next'

const ALLOWED_METHODS = new Set([
  'eth_call',
  'eth_getBalance',
  'eth_chainId',
  'eth_blockNumber',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_feeHistory',
  'eth_maxPriorityFeePerGas',
  'eth_getTransactionCount',
  'net_version',
])

function getOriginHost(req: NextApiRequest): string | null {
  const origin = req.headers.origin ?? req.headers.referer
  if (!origin) return null
  try {
    return new URL(origin).hostname
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appHost = req.headers.host?.split(':')[0]
  const originHost = getOriginHost(req)
  if (!originHost || originHost !== appHost) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const body = req.body
  const requests: { method: string }[] = Array.isArray(body) ? body : [body]

  for (const rpcReq of requests) {
    if (!ALLOWED_METHODS.has(rpcReq.method)) {
      return res.status(403).json({ error: `Method not allowed: ${rpcReq.method}` })
    }
  }

  const alchemyUrl = process.env.ALCHEMY_RPC_URL
  if (!alchemyUrl) {
    return res.status(500).json({ error: 'RPC not configured' })
  }

  try {
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    console.error('[rpc proxy] upstream error:', err)
    return res.status(502).json({ error: 'Bad gateway' })
  }
}
