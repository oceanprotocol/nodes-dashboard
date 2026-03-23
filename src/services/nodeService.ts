import { signNodeCommandMessage } from '@/lib/sign-message';
import { SignMessageFn } from '@/lib/use-ocean-account';
import { Command } from '@/types/commands';
import { MultiaddrsOrPeerId } from '@/types/environments';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';
import type { Connection } from '@libp2p/interface';
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht';
import { peerIdFromString } from '@libp2p/peer-id';
import { ping } from '@libp2p/ping';
import { lpStream, UnexpectedEOFError } from '@libp2p/utils';
import { webSockets } from '@libp2p/websockets';
import { multiaddr } from '@multiformats/multiaddr';
import { createLibp2p, Libp2p } from 'libp2p';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';

let nodeInstance: Libp2p | null = null;
let isNodeReady = false;
const DEFAULT_PROTOCOL = '/ocean/nodes/1.0.0';
const DEFAULT_TIMEOUT = 10000;
const MULTIADDR_DIAL_TIMEOUT = 5000;
const HANDSHAKE_TIMEOUT_MS = 30_000;
const DATA_TIMEOUT_MS = 30 * 60_000;
const RESPONSE_TIMEOUT = 30000;
const BOOTSTRAP_TIMEOUT = 30000;
const MIN_BOOTSTRAP_CONNECTIONS = 1;

function extractPeerId(target: MultiaddrsOrPeerId): string | undefined {
  if (typeof target === 'string') return target;
  return target?.map((a) => a.match(/\/p2p\/(\S+)/)?.[1]).find(Boolean);
}

/**
 * Wait for the node to establish connections to bootstrap nodes
 * and ensure the DHT is ready for queries
 */
async function waitForBootstrapConnections(
  node: Libp2p,
  minConnections: number = MIN_BOOTSTRAP_CONNECTIONS,
  timeout: number = BOOTSTRAP_TIMEOUT
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const connections = node.getConnections();
      const elapsed = Date.now() - startTime;

      console.log(`Bootstrap status: ${connections.length} peer(s) connected (need ${minConnections})`);

      if (connections.length >= minConnections) {
        clearInterval(checkInterval);

        console.log('✓ Bootstrap connections established');
        resolve();
      } else if (elapsed >= timeout) {
        clearInterval(checkInterval);
        reject(
          new Error(
            `Failed to establish minimum bootstrap connections (${connections.length}/${minConnections}) within ${timeout}ms`
          )
        );
      }
    }, 1000);

    const onPeerConnect = () => {
      const connections = node.getConnections();
      if (connections.length >= minConnections) {
        clearInterval(checkInterval);
        node.removeEventListener('peer:connect', onPeerConnect);
        console.log('✓ Bootstrap connections established');
        resolve();
      }
    };

    node.addEventListener('peer:connect', onPeerConnect);
  });
}

export async function initializeNode(bootstrapNodes: string[]) {
  if (nodeInstance && isNodeReady) {
    return nodeInstance;
  }

  try {
    nodeInstance = await createLibp2p({
      transports: [webSockets()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      // overwrite connectionGater for local testing
      // connectionGater: createConnectionGater(),
      peerDiscovery: [
        bootstrap({
          list: bootstrapNodes,
          timeout: 5000,
          tagName: 'bootstrap',
          tagValue: 50,
          tagTTL: 120000,
        }),
      ],
      services: {
        identify: identify(),
        ping: ping(),
        dht: kadDHT({
          allowQueryWithZeroPeers: false,
          maxInboundStreams: 10,
          maxOutboundStreams: 100,
          clientMode: true,
          kBucketSize: 20,
          protocol: '/ocean/nodes/1.0.0/kad/1.0.0',
          peerInfoMapper: passthroughMapper,
        }),
      },
      connectionManager: {
        maxConnections: 100,
        dialTimeout: DEFAULT_TIMEOUT,
        maxPeerAddrsToDial: 25,
        maxParallelDials: 2500,
      },
    });

    await nodeInstance.start();

    console.log('Node started, waiting for bootstrap connections...');

    try {
      await waitForBootstrapConnections(nodeInstance);
      isNodeReady = true;
      console.log('✓ Node is fully initialized and ready for DHT queries');
    } catch (error) {
      console.warn('Bootstrap connection warning:', error);
      isNodeReady = true;
      console.log('⚠ Node started but bootstrap connections may be limited');
    }

    return nodeInstance;
  } catch (error) {
    nodeInstance = null;
    isNodeReady = false;
    throw error;
  }
}

async function dialPeer(target: MultiaddrsOrPeerId): Promise<Connection> {
  if (!nodeInstance) throw new Error('Node not initialized');
  if (!isNodeReady) throw new Error('Node not ready - still establishing bootstrap connections');

  if (typeof target === 'string') {
    return nodeInstance.dial(peerIdFromString(target), { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) });
  }

  try {
    return await nodeInstance.dial(target?.map(multiaddr) ?? [], {
      signal: AbortSignal.timeout(MULTIADDR_DIAL_TIMEOUT),
    });
  } catch (err) {
    const peerId = extractPeerId(target);
    if (!peerId) throw err;

    console.warn(`Multiaddr dials failed for ${peerId}, falling back to DHT...`);
    return nodeInstance.dial(peerIdFromString(peerId), { signal: AbortSignal.timeout(DEFAULT_TIMEOUT) });
  }
}
// Used for local testing to overwrite libp2p connectionGater
// function createConnectionGater(): ConnectionGater {
//   return {
//     denyDialPeer: async () => false,
//     denyDialMultiaddr: async () => false,
//     denyInboundConnection: async () => false,
//     denyOutboundConnection: async () => false,
//     denyInboundEncryptedConnection: async () => false,
//     denyOutboundEncryptedConnection: async () => false,
//     denyInboundUpgradedConnection: async () => false,
//     denyOutboundUpgradedConnection: async () => false,
//     filterMultiaddrForPeer: async () => true,
//   };
// }

export async function getPeerMultiaddr(multiaddrsOrPeerId: MultiaddrsOrPeerId) {
  if (!nodeInstance) {
    throw new Error('Node not initialized');
  }

  if (!isNodeReady) {
    throw new Error('Node not ready');
  }

  const connection = await dialPeer(multiaddrsOrPeerId);
  return connection.remoteAddr.toString();
}

async function attemptCommand(connection: Connection, command: Record<string, any>, protocol: string): Promise<any> {
  const stream = await connection.newStream(protocol, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    runOnLimitedConnection: true,
  });

  if (!stream) {
    throw new Error('Failed to create stream to peer');
  }

  const lp = lpStream(stream);
  await lp.write(uint8ArrayFromString(JSON.stringify(command)), {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  // const statusBytes = await lp.read({ signal: AbortSignal.timeout(DEFAULT_TIMEOUT) });
  // const status = JSON.parse(uint8ArrayToString(statusBytes.subarray()));

  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const chunk = await lp.read({
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      });
      chunks.push(chunk instanceof Uint8Array ? chunk : chunk.subarray());
    }
  } catch (e) {
    if (!(e instanceof UnexpectedEOFError)) {
      throw e;
    }
  }

  let response: unknown;
  for (let i = 0; i < chunks.length; i++) {
    const text = uint8ArrayToString(chunks[i]);
    try {
      response = JSON.parse(text);
    } catch {
      response = chunks[i];
    }
  }

  return response;

  // const res = response as GatewayResponse | null;
  // if (typeof res?.httpStatus === 'number' && res.httpStatus >= 400) {
  //   throw new Error(res.error ?? 'Gateway node error');
  // }

  // const errText = (typeof response === 'string' ? response : res?.error) ?? '';
  // if (errText.includes('Cannot connect to peer') && retrialNumber < MAX_RETRIES) {
  //   await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  //   return P2PCommand(command, multiaddresses, body, signerOrAuthToken, retrialNumber + 1);
  // }

  // return response;

  // return {
  //   status,
  //   stream: {
  //     [Symbol.asyncIterator]: async function* () {
  //       try {
  //         while (true) {
  //           const chunk = await lp.read();
  //           yield chunk.subarray ? chunk.subarray() : chunk;
  //         }
  //       } catch {
  //         // stream ended
  //       }
  //     },
  //   },
  // };
}

export async function sendCommandToPeer(
  multiaddrsOrPeerId: MultiaddrsOrPeerId,
  command: Record<string, any>,
  protocol: string = DEFAULT_PROTOCOL
): Promise<any> {
  if (!nodeInstance) throw new Error('Node not initialized');
  if (!isNodeReady) throw new Error('Node not ready - still establishing bootstrap connections');

  let connection = await dialPeer(multiaddrsOrPeerId);

  try {
    return await attemptCommand(connection, command, protocol);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('closed') && !msg.includes('reset')) {
      console.error('Command failed:', msg);
      throw err;
    }
    // Stale connection — evict and retry once
    console.warn('Stale connection detected, evicting and retrying...');
    await connection.close().catch(() => {});
    connection = await dialPeer(multiaddrsOrPeerId);
    return await attemptCommand(connection, command, protocol);
  }
}

export async function getNodeEnvs(multiaddrsOrPeerId: MultiaddrsOrPeerId) {
  const peerId = extractPeerId(multiaddrsOrPeerId);
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command: Command.COMPUTE_GET_ENVIRONMENTS,
    ...(peerId && { node: peerId }),
  });
}

export async function getComputeStreamableLogs(multiaddrsOrPeerId: MultiaddrsOrPeerId, jobId: string, authToken: any) {
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command: Command.COMPUTE_GET_STREAMABLE_LOGS,
    jobId,
    authorization: authToken.token,
  });
}

export async function getComputeJobResult(
  multiaddrsOrPeerId: MultiaddrsOrPeerId,
  jobId: string,
  index: number,
  authToken: any,
  address: string
) {
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command: Command.COMPUTE_GET_RESULT,
    jobId,
    index,
    consumerAddress: address,
    authorization: authToken,
  });
}

const STREAM_MAX_RETRIES = 10;

/**
 * Extract an HTTPS base URL from a multiaddr array when a DNS name is present.
 * Returns undefined when no DNS-based multiaddr is found (IP-only nodes).
 */
function extractHttpBaseUrl(target: MultiaddrsOrPeerId): string | undefined {
  if (typeof target === 'string' || !target) return undefined;
  for (const addr of target) {
    const match = addr.match(/\/dns[46]\/([^/]+)/);
    if (match) return `https://${match[1]}`;
  }
  return undefined;
}

// ── HTTP streaming (preferred when node has a DNS name) ─────────────────

class PrematureEndError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrematureEndError';
  }
}

async function* streamComputeJobResultHTTP(
  baseUrl: string,
  jobId: string,
  index: number,
  authToken: string,
  address: string,
  cancelSignal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  const params = new URLSearchParams({
    jobId,
    index: String(index),
    consumerAddress: address,
  });

  const response = await fetch(`${baseUrl}/api/services/computeResult?${params}`, {
    headers: { authorization: authToken },
    signal: cancelSignal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `HTTP ${response.status}`);
  }

  const body = response.body;
  if (!body) throw new Error('No response body');

  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// ── P2P streaming (fallback for IP-only nodes) ─────────────────────────

async function* streamComputeJobResultP2P(
  multiaddrsOrPeerId: MultiaddrsOrPeerId,
  jobId: string,
  index: number,
  authToken: string,
  address: string,
  offset: number,
  cancelSignal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  if (!nodeInstance) throw new Error('Node not initialized');
  if (!isNodeReady) throw new Error('Node not ready - still establishing bootstrap connections');

  const command = {
    command: Command.COMPUTE_GET_RESULT,
    jobId,
    index,
    consumerAddress: address,
    authorization: authToken,
    ...(offset > 0 && { offset }),
  };

  let connection = await dialPeer(multiaddrsOrPeerId);

  async function setupStream() {
    const stream = await connection.newStream(DEFAULT_PROTOCOL, {
      signal: AbortSignal.timeout(HANDSHAKE_TIMEOUT_MS),
      runOnLimitedConnection: true,
    });
    if (!stream) throw new Error('Failed to create stream to peer');
    const lp = lpStream(stream);
    await lp.write(uint8ArrayFromString(JSON.stringify(command)), {
      signal: AbortSignal.timeout(HANDSHAKE_TIMEOUT_MS),
    });
    return lp;
  }

  let lp: Awaited<ReturnType<typeof setupStream>>;
  try {
    lp = await setupStream();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('closed') && !msg.includes('reset')) throw err;
    await connection.close().catch(() => {});
    connection = await dialPeer(multiaddrsOrPeerId);
    lp = await setupStream();
  }

  // Read the status response the node always sends first (length-prefixed).
  const statusBytes = await lp.read({ signal: AbortSignal.timeout(HANDSHAKE_TIMEOUT_MS) });
  const statusRaw = statusBytes instanceof Uint8Array ? statusBytes : statusBytes.subarray();
  let status: { httpStatus: number; error?: string };
  try {
    status = JSON.parse(uint8ArrayToString(statusRaw));
  } catch {
    throw new Error('Invalid status response from node');
  }
  if (status.httpStatus !== 200) {
    throw new Error(status.error ?? `Node returned HTTP ${status.httpStatus}`);
  }

  // Stream data chunks with a resettable per-chunk timeout.
  const streamAbort = new AbortController();
  const signal = cancelSignal
    ? AbortSignal.any([streamAbort.signal, cancelSignal])
    : streamAbort.signal;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      streamAbort.abort(new DOMException('Data chunk timeout', 'TimeoutError'));
    }, DATA_TIMEOUT_MS);
  };

  try {
    while (true) {
      resetTimeout();
      const chunk = await lp.read({ signal });
      yield chunk instanceof Uint8Array ? chunk : chunk.subarray();
    }
  } catch (e) {
    if (!(e instanceof UnexpectedEOFError)) throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Public API: auto-selects HTTP vs P2P, retries with resume ───────────

/**
 * Stream a compute job result with automatic retry and resume.
 *
 * • Prefers HTTP when the node has a DNS name (more reliable for large files).
 * • Falls back to P2P for IP-only nodes (or if HTTP fails on first attempt).
 * • On P2P, resumes from last byte using the node's offset parameter.
 *
 * @param expectedBytes - optional expected file size; when set, a premature
 *   stream end (fewer bytes than expected) triggers a retry instead of
 *   silently completing.
 */
export async function* streamComputeJobResult(
  multiaddrsOrPeerId: MultiaddrsOrPeerId,
  jobId: string,
  index: number,
  authToken: string,
  address: string,
  cancelSignal?: AbortSignal,
  expectedBytes?: number
): AsyncGenerator<Uint8Array> {
  const httpBaseUrl = extractHttpBaseUrl(multiaddrsOrPeerId);
  let useHTTP = !!httpBaseUrl;
  let bytesReceived = 0;
  let retries = 0;

  while (true) {
    try {
      let generator: AsyncGenerator<Uint8Array>;

      if (useHTTP) {
        console.log(
          `Downloading via HTTP from ${httpBaseUrl} (attempt ${retries + 1})`
        );
        generator = streamComputeJobResultHTTP(
          httpBaseUrl!,
          jobId,
          index,
          authToken,
          address,
          cancelSignal
        );
      } else {
        console.log(
          `Downloading via P2P${bytesReceived > 0 ? ` (resuming at ${bytesReceived} bytes)` : ''} (attempt ${retries + 1})`
        );
        generator = streamComputeJobResultP2P(
          multiaddrsOrPeerId,
          jobId,
          index,
          authToken,
          address,
          bytesReceived,
          cancelSignal
        );
      }

      for await (const chunk of generator) {
        bytesReceived += chunk.byteLength;
        retries = 0;
        yield chunk;
      }

      // Detect premature EOF: stream ended cleanly but we haven't
      // received enough data yet. Only retry if we got *some* data —
      // 0 bytes means there's genuinely nothing to download.
      if (expectedBytes && expectedBytes > 0 && bytesReceived > 0 && bytesReceived < expectedBytes) {
        throw new PrematureEndError(
          `Stream ended at ${bytesReceived}/${expectedBytes} bytes`
        );
      }

      return; // stream completed normally
    } catch (e) {
      if (cancelSignal?.aborted) throw e;
      if (e instanceof Error && e.name === 'AbortError') throw e;

      retries++;

      // On first HTTP failure, switch to P2P for all subsequent attempts
      if (useHTTP && retries === 1) {
        console.warn(`HTTP download failed, switching to P2P: ${e instanceof Error ? e.message : e}`);
        useHTTP = false;
        bytesReceived = 0; // P2P is a fresh start from offset 0
      } else if (bytesReceived === 0) {
        // Never received any data via P2P — the file likely doesn't
        // exist or the node can't serve it; retrying won't help.
        throw e;
      }

      if (retries > STREAM_MAX_RETRIES) throw e;

      const delay = Math.min(1000 * 2 ** retries, 30_000);
      console.warn(
        `Stream interrupted at ${bytesReceived} bytes, retry ${retries}/${STREAM_MAX_RETRIES} in ${delay}ms…`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function getComputeStatus(multiaddrsOrPeerId: MultiaddrsOrPeerId, jobId: string, consumerAddress: string) {
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command: Command.COMPUTE_GET_STATUS,
    jobId,
    consumerAddress,
  });
}

export async function getNonce(multiaddrsOrPeerId: MultiaddrsOrPeerId, consumerAddress: string): Promise<number> {
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command: Command.NONCE,
    address: consumerAddress,
  });
}

export async function initializeCompute(
  multiaddrsOrPeerId: MultiaddrsOrPeerId,
  body: Record<string, unknown>
): Promise<{ payment: { amount: string; minLockSeconds: number }; status?: { httpStatus: number; error?: string } }> {
  const peerId = extractPeerId(multiaddrsOrPeerId);
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command: Command.INITIALIZE_COMPUTE,
    ...(peerId && { node: peerId }),
    ...body,
  });
}

export async function createAuthToken({
  consumerAddress,
  multiaddrsOrPeerId,
  signMessage,
}: {
  consumerAddress: string;
  multiaddrsOrPeerId: MultiaddrsOrPeerId;
  signMessage: SignMessageFn;
}): Promise<{ token: string }> {
  const command = Command.CREATE_AUTH_TOKEN;
  const incrementedNonce = (await getNonce(multiaddrsOrPeerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    address: consumerAddress,
    command,
    nonce: incrementedNonce,
    signature,
  });
}

export async function getNodeLogs({
  consumerAddress,
  expiryTimestamp,
  multiaddrsOrPeerId,
  params,
  signMessage,
}: {
  consumerAddress: string;
  expiryTimestamp: number;
  multiaddrsOrPeerId: MultiaddrsOrPeerId;
  params: { startTime?: string; endTime?: string; maxLogs?: number; moduleName?: string; level?: string };
  signMessage: SignMessageFn;
}) {
  const command = Command.GET_LOGS;
  const incrementedNonce = (await getNonce(multiaddrsOrPeerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    address: consumerAddress,
    command,
    expiryTimestamp,
    nonce: incrementedNonce,
    signature,
    ...params,
  });
}

export async function fetchNodeConfig({
  consumerAddress,
  expiryTimestamp,
  multiaddrsOrPeerId,
  signMessage,
}: {
  consumerAddress: string;
  expiryTimestamp: number;
  multiaddrsOrPeerId: MultiaddrsOrPeerId;
  signMessage: SignMessageFn;
}) {
  const command = Command.FETCH_CONFIG;
  const incrementedNonce = (await getNonce(multiaddrsOrPeerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    address: consumerAddress,
    command,
    expiryTimestamp,
    nonce: incrementedNonce,
    signature,
  });
}

export async function pushNodeConfig({
  config,
  consumerAddress,
  expiryTimestamp,
  multiaddrsOrPeerId,
  signMessage,
}: {
  consumerAddress: string;
  config: Record<string, any>;
  expiryTimestamp: number;
  multiaddrsOrPeerId: MultiaddrsOrPeerId;
  signMessage: SignMessageFn;
}) {
  const command = Command.PUSH_CONFIG;
  const incrementedNonce = (await getNonce(multiaddrsOrPeerId, consumerAddress)) + 1;
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    incrementedNonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    address: consumerAddress,
    command,
    config,
    expiryTimestamp,
    nonce: incrementedNonce,
    signature,
  });
}

export async function stopNode() {
  if (nodeInstance) {
    await nodeInstance.stop();
    nodeInstance = null;
    isNodeReady = false;
  }
}

export function getNodeInstance(): Libp2p | null {
  return nodeInstance;
}

export function getNodeReadyState(): boolean {
  return isNodeReady && nodeInstance !== null;
}
