import { NODE_URL } from '@/lib/constants';

export async function directNodeCommand(command: string, peerId: string, body: any): Promise<Response> {
  try {
    const response = await fetch(`${NODE_URL}/directCommand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command,
        node: peerId,
        ...body,
      }),
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
