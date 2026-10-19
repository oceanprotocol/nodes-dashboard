import { getApiRoute } from '@/config';
import { Node } from '@/types/nodes';
import axios from 'axios';

type NodesResponse = {
  nodes?: { _source: Node }[];
};

const NAME_SEARCH_SIZE = 10;

const fetchNodes = async (params: Record<string, string | number>): Promise<Node[]> => {
  const response = await axios.get<NodesResponse>(getApiRoute('nodes'), { params });
  return response.data?.nodes?.map((hit) => hit._source) ?? [];
};

export async function findNode(idOrName: string): Promise<Node | null> {
  const query = idOrName.trim();
  const [byId] = await fetchNodes({ nodeId: query, size: 1 });
  if (byId) {
    return byId;
  }
  const name = query.toLowerCase();
  const byName = (await fetchNodes({ search: query, size: NAME_SEARCH_SIZE })).filter(
    (node) => node.friendlyName?.toLowerCase() === name
  );
  if (byName.length > 1) {
    throw new Error(`More than one node is named "${query}". Use its node ID instead.`);
  }
  return byName[0] ?? null;
}

export async function fetchNodesByIds(ids: string[], search?: string): Promise<Node[]> {
  if (ids.length === 0) {
    return [];
  }
  return fetchNodes({
    filters: JSON.stringify({ id: { value: ids.join(',') } }),
    size: ids.length,
    ...(search ? { search } : {}),
  });
}
