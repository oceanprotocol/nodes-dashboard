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
