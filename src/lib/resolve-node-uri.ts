import type { NodeUri } from '@/contexts/P2PContext';

export function resolveNodeUri(peerId: string, multiaddrs?: string[] | null): NodeUri {
  const addrs = (multiaddrs ?? []).map((a) => (a.includes('/p2p/') ? a : `${a}/p2p/${peerId}`));
  return addrs.length > 0 ? addrs : peerId;
}
