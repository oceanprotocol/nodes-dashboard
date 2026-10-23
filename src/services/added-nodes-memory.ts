const STORAGE_PREFIX = 'added-nodes';

const storageKey = (owner: string) => `${STORAGE_PREFIX}-${owner.toLowerCase()}`;

export function recallAddedNodeIds(owner: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(owner)) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.error('Failed to read added nodes:', error);
    return [];
  }
}

export function rememberAddedNodeId(owner: string, nodeId: string): void {
  const ids = recallAddedNodeIds(owner);
  if (ids.includes(nodeId)) {
    return;
  }
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify([...ids, nodeId]));
  } catch (error) {
    console.error('Failed to remember added node:', error);
  }
}
