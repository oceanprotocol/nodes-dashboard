import { Command } from '@/types/commands';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';
import type { Connection, ConnectionGater } from '@libp2p/interface';
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht';
import { peerIdFromString } from '@libp2p/peer-id';
import { ping } from '@libp2p/ping';
import { webSockets } from '@libp2p/websockets';
import { createLibp2p, Libp2p } from 'libp2p';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';

let nodeInstance: Libp2p | null = null;
let isNodeReady = false;
const DEFAULT_PROTOCOL = '/ocean/nodes/1.0.0';
const DEFAULT_TIMEOUT = 10000;
const BOOTSTRAP_TIMEOUT = 30000;
const MIN_BOOTSTRAP_CONNECTIONS = 1;

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
      connectionGater: createConnectionGater(),
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

function createConnectionGater(): ConnectionGater {
  return {
    denyDialPeer: async () => false,
    denyDialMultiaddr: async () => false,
    denyInboundConnection: async () => false,
    denyOutboundConnection: async () => false,
    denyInboundEncryptedConnection: async () => false,
    denyOutboundEncryptedConnection: async () => false,
    denyInboundUpgradedConnection: async () => false,
    denyOutboundUpgradedConnection: async () => false,
    filterMultiaddrForPeer: async () => true,
  };
}

export async function sendCommandToPeer(
  peerId: string,
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

    let connection: Connection;
    try {
      connection = await nodeInstance.dial(peerIdFromString(peerId), {
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      });
    } catch (error: unknown) {
      console.log({ error, message: 'Failed to dial discovered addresses' });
      throw error;
    }

    const stream = await connection.newStream(protocol, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      runOnLimitedConnection: true,
    });

    if (!stream) {
      throw new Error(`Failed to create stream to peer ${peerId}`);
    }

    stream.send(uint8ArrayFromString(JSON.stringify(command)));
    await stream.close();

    const iterator = stream[Symbol.asyncIterator]();
    const { done, value } = await iterator.next();

    if (done || !value) {
      return { status: { httpStatus: 500, error: 'No response from peer' } };
    }

    const metadata = JSON.parse(uint8ArrayToString(value.subarray()));

    if (metadata.httpStatus !== 200) {
      return { status: { httpStatus: metadata.httpStatus, error: metadata.error } };
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk.subarray());
    }

    if (chunks.length === 0) {
      return { status: { httpStatus: 500, error: 'No data in response' } };
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const fullData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      fullData.set(chunk, offset);
      offset += chunk.length;
    }

    const firstByte = fullData[0];
    // Check if the response is a JSON
    if (firstByte === 123 || firstByte === 91) {
      return JSON.parse(uint8ArrayToString(fullData));
    }

    return fullData;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Command failed:', errorMessage);
    throw error;
  }
}

export async function getNodeEnvs(peerId: string) {
  return sendCommandToPeer(peerId, { command: Command.COMPUTE_GET_ENVIRONMENTS, node: peerId });
}

export async function getComputeStreamableLogs(peerId: string, jobId: string, authToken: any) {
  return sendCommandToPeer(peerId, {
    command: Command.COMPUTE_GET_STREAMABLE_LOGS,
    jobId,
    authorization: authToken.token,
  });
}

export async function getComputeJobResult(
  peerId: string,
  jobId: string,
  index: number,
  authToken: any,
  address: string
) {
  return sendCommandToPeer(peerId, {
    command: Command.COMPUTE_GET_RESULT,
    jobId,
    index,
    consumerAddress: address,
    authorization: authToken.token,
  });
}

export async function getNonce(peerId: string, consumerAddress: string): Promise<number> {
  return sendCommandToPeer(peerId, {
    command: Command.NONCE,
    address: consumerAddress,
  });
}

export async function createAuthToken(
  peerId: string,
  consumerAddress: string,
  signature: string,
  nonce: string
): Promise<string> {
  return sendCommandToPeer(peerId, {
    command: Command.CREATE_AUTH_TOKEN,
    address: consumerAddress,
    signature,
    nonce,
  });
}

export async function fetchNodeConfig(peerId: string, signature: string, expiryTimestamp: number, address?: string) {
  return sendCommandToPeer(peerId, { command: 'fetchConfig', signature, expiryTimestamp, address });
}

export async function pushNodeConfig(
  peerId: string,
  signature: string,
  expiryTimestamp: number,
  config: Record<string, any>,
  address?: string
) {
  return sendCommandToPeer(peerId, { command: 'pushConfig', signature, expiryTimestamp, config, address });
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
