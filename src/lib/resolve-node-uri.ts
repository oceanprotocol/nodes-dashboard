export function resolveNodeUri(peerId: string, multiaddrs?: string[] | null): string[] | null {
  if (!peerId || !multiaddrs?.length) {
    return null;
  }
  return multiaddrs.map((a) => (a.includes('/p2p/') ? a : `${a}/p2p/${peerId}`));
}
