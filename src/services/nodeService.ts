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

function toBytes(chunk: Uint8Array | { subarray(): Uint8Array }): Uint8Array {
  return chunk instanceof Uint8Array ? chunk : chunk.subarray();
}

async function* remainingChunks(
  it: AsyncIterator<Uint8Array | { subarray(): Uint8Array }>
): AsyncGenerator<Uint8Array> {
  let next = await it.next();
  while (!next.done && next.value !== null) {
    yield toBytes(next.value);
    next = await it.next();
  }
}

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

export async function sendCommandToPeer(
  multiaddrsOrPeerId: MultiaddrsOrPeerId,
  command: Record<string, any>,
  protocol: string = DEFAULT_PROTOCOL
): Promise<any> {
  try {
    if (!nodeInstance) {
      throw new Error('Node not initialized');
    }

    if (!isNodeReady) {
      throw new Error('Node not ready - still establishing bootstrap connections');
    }

    const connection = await dialPeer(multiaddrsOrPeerId);

    const stream = await connection.newStream(protocol, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      runOnLimitedConnection: true,
    });

    if (!stream) {
      throw new Error(`Failed to create stream to peer`);
    }

    stream.send(uint8ArrayFromString(JSON.stringify(command)));
    await stream.close();

    const responsePromise = (async () => {
      const it = stream[Symbol.asyncIterator]();
      const { done, value } = await it.next();
      const firstChunk = value !== null ? toBytes(value) : null;

      if (done || !firstChunk?.length) {
        return { status: { httpStatus: 500, error: 'No response from peer' } };
      }

      const statusText = uint8ArrayToString(firstChunk);
      try {
        const status = JSON.parse(statusText);
        if (typeof status?.httpStatus === 'number' && status.httpStatus >= 400) {
          return { status: { httpStatus: status.httpStatus, error: status.error } };
        }
      } catch {
        // First chunk not valid JSON status, continue
      }

      const chunks: Uint8Array[] = [firstChunk];
      for await (const c of remainingChunks(it)) {
        chunks.push(c);
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

      const res = response as { httpStatus?: number; error?: string } | null;
      if (typeof res?.httpStatus === 'number' && res.httpStatus >= 400) {
        return { status: { httpStatus: res.httpStatus, error: res.error } };
      }

      return response;
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`Response timeout: peer ${multiaddrsOrPeerId} did not respond within ${RESPONSE_TIMEOUT}ms`)
          ),
        RESPONSE_TIMEOUT
      )
    );

    return await Promise.race([responsePromise, timeoutPromise]);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Command failed:', errorMessage);
    throw error;
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
  const nonce = await getNonce(multiaddrsOrPeerId, consumerAddress);
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    nonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command,
    address: consumerAddress,
    signature,
    nonce,
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
  const nonce = await getNonce(multiaddrsOrPeerId, consumerAddress);
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    nonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command,
    signature,
    expiryTimestamp,
    address: consumerAddress,
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
  const nonce = await getNonce(multiaddrsOrPeerId, consumerAddress);
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    nonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command,
    signature,
    expiryTimestamp,
    address: consumerAddress,
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
  const nonce = await getNonce(multiaddrsOrPeerId, consumerAddress);
  const signature = await signNodeCommandMessage({
    command,
    consumerAddress,
    nonce,
    signMessage,
  });
  return sendCommandToPeer(multiaddrsOrPeerId, {
    command,
    signature,
    expiryTimestamp,
    config,
    address: consumerAddress,
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
