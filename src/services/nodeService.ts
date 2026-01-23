import { Command } from '@/types/commands';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';
import type { Connection, PeerId } from '@libp2p/interface';
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht';
import { peerIdFromString } from '@libp2p/peer-id';
import { ping } from '@libp2p/ping';
import { webSockets } from '@libp2p/websockets';
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr';
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
        console.log(
          'peers',
          connections.map((conn) => conn.remotePeer.toString())
        );

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
        console.log(
          'peers',
          connections.map((conn) => conn.remotePeer.toString())
        );
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

function hasMultiAddr(addr: Multiaddr, multiAddresses: Multiaddr[]) {
  const addrStr = addr.toString();
  for (let i = 0; i < multiAddresses.length; i++) {
    if (multiAddresses[i].toString() === addrStr) return true;
  }
  return false;
}

function normalizeMultiaddr(addr: Multiaddr): Multiaddr | null {
  try {
    let addrStr = addr.toString();

    if (addrStr.includes('/ws/tcp/')) {
      addrStr = addrStr.replace('/ws/tcp/', '/tcp/');
      if (addrStr.includes('/p2p/')) {
        addrStr = addrStr.replace('/p2p/', '/ws/p2p/');
      } else {
        addrStr = addrStr + '/ws';
      }
    }
    if (addrStr.includes('/wss/tcp/')) {
      addrStr = addrStr.replace('/wss/tcp/', '/tcp/');
      if (addrStr.includes('/p2p/')) {
        addrStr = addrStr.replace('/p2p/', '/wss/p2p/');
      } else {
        addrStr = addrStr + '/wss';
      }
    }

    return multiaddr(addrStr);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.warn(`Failed to normalize address ${addr.toString()}: ${errorMessage}`);
    return null;
  }
}

async function discoverPeerAddresses(node: Libp2p, peer: string): Promise<Multiaddr[]> {
  const allMultiaddrs: Multiaddr[] = [];

  let peerId: PeerId;
  try {
    peerId = peerIdFromString(peer);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error('Failed to parse peerId:', errorMessage);
    throw new Error(`Invalid peerId format: ${peer}`);
  }

  try {
    const peerData = await node.peerStore.get(peerId);

    if (peerData && peerData.addresses) {
      console.log(`Found ${peerData.addresses.length} addresses in peerStore`);
      for (const addr of peerData.addresses) {
        // Convert to string and back to ensure type compatibility
        const addrStr = addr.multiaddr.toString();
        const addrMultiaddr = multiaddr(addrStr);
        if (!hasMultiAddr(addrMultiaddr, allMultiaddrs)) {
          const normalized = normalizeMultiaddr(addrMultiaddr);
          if (normalized) {
            allMultiaddrs.push(normalized);
          }
        }
      }
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log('peerStore query failed:', errorMessage);
  }

  try {
    const peerInfo = await node.peerRouting.findPeer(peerId, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      useCache: false,
      useNetwork: true,
    });

    if (peerInfo && peerInfo.multiaddrs) {
      console.log(`Found ${peerInfo.multiaddrs.length} addresses via DHT`);
      for (const addr of peerInfo.multiaddrs) {
        // Convert to string and back to ensure type compatibility
        const addrStr = addr.toString();
        const addrMultiaddr = multiaddr(addrStr);
        if (!hasMultiAddr(addrMultiaddr, allMultiaddrs)) {
          const normalized = normalizeMultiaddr(addrMultiaddr);
          if (normalized) {
            allMultiaddrs.push(normalized);
          }
        }
      }
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log('DHT query failed:', errorMessage);
  }

  console.log(`\nDiscovery summary: ${allMultiaddrs.length} total addresses found`);

  if (allMultiaddrs.length === 0) {
    console.error(`No addresses found for peer ${peer}`);
    throw new Error(
      `Could not discover any addresses for peer ${peer}. ` + `Ensure the target peer is online and accessible.`
    );
  }

  const wssAddrs = allMultiaddrs.filter((ma) => {
    const str = ma.toString();
    return str.includes('/wss');
  });

  console.log(`WebSocket-compatible addresses: ${wssAddrs.length}`);

  if (wssAddrs.length === 0) {
    console.error(`Found ${allMultiaddrs.length} addresses but none use WebSocketSecure protocol`);
  }

  const finalmultiaddrsWithPeerId: Multiaddr[] = [];
  const finalmultiaddrsWithoutPeerId: Multiaddr[] = [];

  for (const addr of wssAddrs) {
    const addrStr = addr.toString();

    if (addrStr.includes(`/p2p/${peer}`)) {
      finalmultiaddrsWithPeerId.push(addr);
    } else {
      // For p2p-circuit (circuit relay), always add peer ID
      if (addrStr.includes('p2p-circuit')) {
        finalmultiaddrsWithPeerId.push(multiaddr(`${addrStr}/p2p/${peer}`));
      } else {
        finalmultiaddrsWithoutPeerId.push(addr);
      }
    }
  }

  const finalmultiaddrs =
    finalmultiaddrsWithPeerId.length > finalmultiaddrsWithoutPeerId.length
      ? finalmultiaddrsWithPeerId
      : finalmultiaddrsWithoutPeerId;

  if (finalmultiaddrs.length === 0) {
    throw new Error(`No valid addresses found for peer ${peer}`);
  }

  return finalmultiaddrs;
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

    try {
      const response = JSON.parse(uint8ArrayToString(fullData));
      return response;
    } catch {
      return fullData;
    }
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

export async function fetchNodeConfig(peerId: string, signature: string, expiryTimestamp: number, address: string) {
  return sendCommandToPeer(peerId, { command: 'fetchConfig', signature, expiryTimestamp, address });
}

export async function pushNodeConfig(
  peerId: string,
  signature: string,
  expiryTimestamp: number,
  config: Record<string, any>,
  address: string
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
