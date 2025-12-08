export interface P2PCommandRequest {
  peerId: string;
  command: Record<string, any>;
  protocol?: string;
}

export interface P2PCommandResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface P2PStatusResponse {
  initialized: boolean;
  ready: boolean;
  peerId?: string;
  connectedPeers?: number;
  addresses?: string[];
}

/**
 * Send a command to a peer via the server-side API
 */
export async function sendCommandToPeerAPI(
  peerId: string,
  command: Record<string, any>,
  protocol?: string
): Promise<any> {
  const response = await fetch('/api/p2p/command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      peerId,
      command,
      protocol,
    }),
  });

  const result: P2PCommandResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Command failed');
  }

  return result.data;
}

/**
 * Get compute environments from a peer via the server-side API
 */
export async function getNodeEnvsAPI(peerId: string): Promise<any> {
  const response = await fetch(`/api/p2p/envs?peerId=${encodeURIComponent(peerId)}`);

  const result: P2PCommandResponse = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to get environments');
  }

  return result.data;
}

/**
 * Get the status of the server-side P2P node
 */
export async function getNodeStatusAPI(): Promise<P2PStatusResponse> {
  const response = await fetch('/api/p2p/status');
  return response.json();
}

/**
 * Explicitly initialize the server-side P2P node
 * This triggers initialization and waits for it to complete
 */
export async function initializeNodeAPI(): Promise<P2PStatusResponse> {
  console.log('[P2P API] Triggering server-side node initialization...');

  const response = await fetch('/api/p2p/init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to initialize node');
  }

  console.log('[P2P API] ✓ Server-side node initialized');
  return result.status;
}

/**
 * Wait for the server-side node to be ready
 * Polls the status endpoint until the node is initialized and ready
 */
export async function waitForNodeReady(timeoutMs: number = 30000, pollIntervalMs: number = 1000): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const status = await getNodeStatusAPI();

        if (status.ready) {
          console.log('✓ Server-side node is ready');
          resolve();
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed >= timeoutMs) {
          reject(new Error('Timeout waiting for node to be ready'));
          return;
        }

        console.log(`Waiting for node... (${status.connectedPeers || 0} peers connected)`);
        setTimeout(checkStatus, pollIntervalMs);
      } catch (error) {
        console.error('Failed to check node status:', error);
        setTimeout(checkStatus, pollIntervalMs);
      }
    };

    checkStatus();
  });
}
