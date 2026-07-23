// Services and templates live per-node. Until the flow lets the user pick a node, we target a single
// default node by peer id + full multiaddr so the P2P layer can reach it without a separate peer lookup.
// TODO: aggregate across all reachable nodes, not just the default one.
export const DEFAULT_NODE_ID = '16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi';
export const DEFAULT_NODE_URI = [
  '/ip4/35.202.16.215/tcp/9001/tls/sni/35-202-16-215.kzwfwjn5ji4puuok23h2yyzro0fe1rqv1bqzbmrjf7uqyj504rawjl4zs68mepr.libp2p.direct/ws/p2p/16Uiu2HAmR9z4EhF9zoZcErrdcEJKCjfTpXJfBcmbNppbT3QYtBpi',
];
