import { createLibp2p, Libp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { peerIdFromString } from '@libp2p/peer-id'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { multiaddr } from '@multiformats/multiaddr'
import { all } from '@libp2p/websockets/filters'

let nodeInstance: Libp2p | null = null

export async function initializeNode(bootstrapNodes: string[]) {
  if (!nodeInstance) {
    nodeInstance = await createLibp2p({
      transports: [webSockets({ filter: all })],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [
        bootstrap({
          list: bootstrapNodes,
          timeout: 5000,
          tagName: 'bootstrap',
          tagValue: 50,
          tagTTL: 120000
        })
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
          peerInfoMapper: passthroughMapper
        })
      },
      connectionManager: {
        minConnections: 2,
        maxConnections: 100,
        dialTimeout: 10000,
        autoDialInterval: 5000,
        autoDialConcurrency: 500,
        maxPeerAddrsToDial: 25,
        autoDialPeerRetryThreshold: 120000,
        maxParallelDials: 2500
      }
    })

    await nodeInstance.start()
  }

  return nodeInstance
}

function hasMultiAddr(addr: any, multiAddresses: any[]) {
  const addrStr = addr.toString()
  for (let i = 0; i < multiAddresses.length; i++) {
    if (multiAddresses[i].toString() === addrStr) return true
  }
  return false
}

function normalizeMultiaddr(addr: any): any | null {
  try {
    let addrStr = addr.toString()

    if (addrStr.includes('/ws/tcp/')) {
      addrStr = addrStr.replace('/ws/tcp/', '/tcp/')
      if (addrStr.includes('/p2p/')) {
        addrStr = addrStr.replace('/p2p/', '/ws/p2p/')
      } else {
        addrStr = addrStr + '/ws'
      }
    }

    return multiaddr(addrStr)
  } catch (e: any) {
    console.warn(`Failed to normalize address ${addr.toString()}: ${e.message}`)
    return null
  }
}

async function discoverPeerAddresses(node: Libp2p, peer: string): Promise<any[]> {
  const allMultiaddrs: any[] = []

  let peerId: any
  try {
    peerId = peerIdFromString(peer)
  } catch (e) {
    console.error('Failed to parse peerId:', e)
    throw new Error(`Invalid peerId format: ${peer}`)
  }

  try {
    const peerData = await node.peerStore.get(peerId)

    if (peerData && peerData.addresses) {
      console.log(`Found ${peerData.addresses.length} addresses in peerStore`)
      for (const addr of peerData.addresses) {
        if (!hasMultiAddr(addr.multiaddr, allMultiaddrs)) {
          const normalized = normalizeMultiaddr(addr.multiaddr)
          if (normalized) {
            allMultiaddrs.push(normalized)
          }
        }
      }
    }
  } catch (e: any) {
    console.log('peerStore query failed:', e.message)
  }

  try {
    const peerInfo = await node.peerRouting.findPeer(peerId, {
      signal: AbortSignal.timeout(10000),
      useCache: false,
      useNetwork: true
    })

    if (peerInfo && peerInfo.multiaddrs) {
      console.log(`Found ${peerInfo.multiaddrs.length} addresses via DHT`)
      for (const addr of peerInfo.multiaddrs) {
        if (!hasMultiAddr(addr, allMultiaddrs)) {
          const normalized = normalizeMultiaddr(addr)
          if (normalized) {
            allMultiaddrs.push(normalized)
          }
        }
      }
    }
  } catch (e: any) {
    console.log('DHT query failed:', e.message)
  }

  console.log(`\nDiscovery summary: ${allMultiaddrs.length} total addresses found`)

  if (allMultiaddrs.length === 0) {
    console.error(`No addresses found for peer ${peer}`)
    throw new Error(
      `Could not discover any addresses for peer ${peer}. ` +
        `Ensure the target peer is online and accessible.`
    )
  }

  const wsAddrs = allMultiaddrs.filter((ma) => {
    const str = ma.toString()
    return str.includes('/ws') || str.includes('/wss')
  })

  console.log(`WebSocket-compatible addresses: ${wsAddrs.length}`)

  if (wsAddrs.length === 0) {
    console.error(
      `Found ${allMultiaddrs.length} addresses but none use WebSocket protocol`
    )
  }

  const finalmultiaddrsWithPeerId: any[] = []
  const finalmultiaddrsWithoutPeerId: any[] = []

  for (const addr of wsAddrs) {
    const addrStr = addr.toString()

    if (addrStr.includes(`/p2p/${peer}`)) {
      finalmultiaddrsWithPeerId.push(addr)
    } else {
      // For p2p-circuit (circuit relay), always add peer ID
      if (addrStr.includes('p2p-circuit')) {
        finalmultiaddrsWithPeerId.push(multiaddr(`${addrStr}/p2p/${peer}`))
      } else {
        finalmultiaddrsWithoutPeerId.push(addr)
      }
    }
  }

  const finalmultiaddrs =
    finalmultiaddrsWithPeerId.length > finalmultiaddrsWithoutPeerId.length
      ? finalmultiaddrsWithPeerId
      : finalmultiaddrsWithoutPeerId

  if (finalmultiaddrs.length === 0) {
    throw new Error(`No valid addresses found for peer ${peer}`)
  }

  return finalmultiaddrs
}

export async function sendCommandToPeer(
  peerId: string,
  command: any,
  protocol: string = '/ocean/nodes/1.0.0'
): Promise<any> {
  try {
    if (!nodeInstance) {
      throw new Error('Node not initialized')
    }

    const discovered = await discoverPeerAddresses(nodeInstance, peerId)

    const connection = await nodeInstance.dial(discovered, {
      signal: AbortSignal.timeout(10000)
    })

    const stream = await connection.newStream(protocol, {
      signal: AbortSignal.timeout(10000)
    })

    const message = JSON.stringify(command)
    let response = ''

    await stream.sink([uint8ArrayFromString(message)])

    let firstChunk = true
    for await (const chunk of stream.source) {
      const str = uint8ArrayToString(chunk.subarray())

      if (firstChunk) {
        firstChunk = false
        try {
          const parsed = JSON.parse(str)
          if (parsed.httpStatus !== undefined) {
            continue
          }
        } catch (e) {}
      }

      response += str
    }

    await stream.close()

    return JSON.parse(response)
  } catch (error: any) {
    console.error('Command failed:', error.message)
    throw error
  }
}

export async function getNodeEnvs(peerId: string) {
  return sendCommandToPeer(peerId, { command: 'getComputeEnvironments', node: peerId })
}

export async function stopNode() {
  if (nodeInstance) {
    await nodeInstance.stop()
    nodeInstance = null
  }
}

export function getNodeInstance(): Libp2p | null {
  return nodeInstance
}

export function getConnectedPeerCount(): number {
  return nodeInstance?.getPeers().length || 0
}
