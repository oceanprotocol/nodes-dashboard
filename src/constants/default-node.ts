// Services and templates live per-node. Until the flow lets the user pick a node, we target a single
// default node by peer id + full multiaddr so the P2P layer can reach it without a separate peer lookup.
// TODO: aggregate across all reachable nodes, not just the default one.
export const DEFAULT_NODE_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi';
export const DEFAULT_NODE_URI = [
  '/ip4/35.202.16.215/tcp/9001/tls/sni/35-202-16-215.kzwfwjn5ji4puuok23h2yyzro0fe1rqv1bqzbmrjf7uqyj504rawjl4zs68mepr.libp2p.direct/ws/p2p/16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
];

/**
 * The SAME node as DEFAULT_NODE_URI above, addressed over HTTP instead of libp2p — `test1.oncompute.ai`
 * resolves to 35.202.16.215, the ip in that multiaddr, and the node behind it reports DEFAULT_NODE_ID.
 *
 * The two MUST stay the same node. ocean.js picks its transport from the shape of the uri it is handed
 * (a url → HttpProvider, a multiaddr → P2pProvider; see BaseProvider.getImpl), so the catalogue fetch
 * passes this one first and falls back to the multiaddr — if these ever named different nodes, which
 * catalogue you got would depend on whether HTTP happened to answer, and the mismatch would be silent.
 *
 * Deliberately NOT `NODE_URL` from lib/constants, despite being the same string today: that constant is
 * the gateway used for /directCommand relaying and access lists, which is a role that could legitimately
 * move to a different host. This one is pinned to the default node itself.
 */
export const DEFAULT_NODE_HTTP_URL = 'http://localhost:8001'; // LOCAL VRAM TEST — revert to 'https://test1.oncompute.ai'

// Nodes reached over HTTPS, not browser libp2p (AutoTLS libp2p.direct outage, ipshipyard/p2p-forge#97).
export const HTTP_NODE_URLS: Record<string, string> = {
  '16Uiu2HAmBxtwWEH8m9HLdCJncZGe9Ukj5xLxNhvM5KY17jjz899q': 'https://cp1.oncompute.ai',
  [DEFAULT_NODE_ID]: DEFAULT_NODE_HTTP_URL,
};
