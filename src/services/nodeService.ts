// This runs client-side only with bundled npm packages
import { createLibp2p, Libp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { kadDHT, passthroughMapper } from '@libp2p/kad-dht'
import { pipe } from 'it-pipe'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { peerIdFromString } from '@libp2p/peer-id'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { multiaddr } from '@multiformats/multiaddr'
import { all } from '@libp2p/websockets/filters'

let nodeInstance: Libp2p | null = null
let isWarmedUp = false

const permissiveConnectionGater = {
  denyDialPeer: async () => false,
  denyDialMultiaddr: async () => false,
  denyInboundConnection: async () => false,
  denyOutboundConnection: async () => false,
  denyInboundEncryptedConnection: async () => false,
  denyOutboundEncryptedConnection: async () => false,
  denyInboundUpgradedConnection: async () => false,
  denyOutboundUpgradedConnection: async () => false,
  filterMultiaddrForPeer: async (peer: any) => peer.multiaddrs
}

async function warmUpNode(
  node: Libp2p,
  minPeers: number = 2,
  maxWaitMs: number = 15000
): Promise<boolean> {
  console.log('🔥 Warming up P2P node...')
  const startTime = Date.now()

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const peers = node.getPeers()
      const elapsed = Date.now() - startTime

      console.log(`  Connected peers: ${peers.length}, elapsed: ${elapsed}ms`)

      if (peers.length >= minPeers) {
        console.log('✓ Node warmed up successfully')
        clearInterval(checkInterval)
        resolve(true)
      } else if (elapsed >= maxWaitMs) {
        console.warn(`⚠️ Warmup timeout reached with only ${peers.length} peers`)
        clearInterval(checkInterval)
        resolve(false)
      }
    }, 1000)
  })
}

export async function initializeNode(bootstrapNodes: string[]) {
  if (!nodeInstance) {
    nodeInstance = await createLibp2p({
      transports: [webSockets({ filter: all })],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      connectionGater: permissiveConnectionGater,
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

    nodeInstance.addEventListener('peer:discovery', async (evt: any) => {
      const peerId = evt.detail.id
      const peerIdStr = peerId.toString()

      // Workaround in browser: populate the peerstore
      // dependency on bootstrapNodes list
      for (const bootstrapAddr of bootstrapNodes) {
        try {
          const ma = multiaddr(bootstrapAddr)
          if (ma.getPeerId() === peerIdStr) {
            console.log(`  📝 Adding bootstrap address from list: ${bootstrapAddr}`)

            await nodeInstance!.peerStore.save(peerId, {
              addresses: [
                {
                  multiaddr: ma,
                  isCertified: false
                }
              ]
            })

            // Verify
            const check = await nodeInstance!.peerStore.get(peerId)
            console.log(`PeerStore now has ${check.addresses?.length || 0} address(es)`)

            // With autoDial: true, connectionManager will dial automatically
            // OR manually dial if autoDial isn't working:
            if (check.addresses?.length === 0) {
              // Manual dial as fallback
              console.log(`  🔌 Manually dialing...`)
              nodeInstance!
                .dial(ma)
                .catch((e: any) => console.error(`Dial failed: ${e.message}`))
            }

            break
          }
        } catch (e) {
          // Not a match
        }
      }
    })

    // Wait for warmup
    if (!isWarmedUp) {
      await warmUpNode(nodeInstance)
      isWarmedUp = true
    }
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

// Comprehensive peer discovery (from nodeService.ts)
async function discoverPeerAddresses(node: Libp2p, peer: string): Promise<any[]> {
  const allMultiaddrs: any[] = []

  console.log(`Starting peer discovery for: ${peer}`)

  let peerId: any
  try {
    peerId = peerIdFromString(peer)
  } catch (e) {
    console.error('Failed to parse peerId:', e)
    throw new Error(`Invalid peerId format: ${peer}`)
  }

  try {
    console.log('Checking peerStore...')
    const peerData = await node.peerStore.get(peerId)

    if (peerData && peerData.addresses) {
      console.log(`Found ${peerData.addresses.length} addresses in peerStore`)
      for (const addr of peerData.addresses) {
        if (!hasMultiAddr(addr.multiaddr, allMultiaddrs)) {
          console.log(`    + ${addr.multiaddr.toString()}`)
          allMultiaddrs.push(addr.multiaddr)
        }
      }
    }
  } catch (e: any) {
    console.log('peerStore query failed:', e.message)
  }

  try {
    console.log('Querying DHT...')
    const peerInfo = await node.peerRouting.findPeer(peerId, {
      signal: AbortSignal.timeout(10000),
      useCache: false,
      useNetwork: true
    })

    if (peerInfo && peerInfo.multiaddrs) {
      console.log(`Found ${peerInfo.multiaddrs.length} addresses via DHT`)
      for (const addr of peerInfo.multiaddrs) {
        if (!hasMultiAddr(addr, allMultiaddrs)) {
          console.log(`    + ${addr.toString()}`)
          allMultiaddrs.push(addr)
        }
      }
    }
  } catch (e: any) {
    console.log('DHT query failed:', e.message)
  }

  try {
    console.log('Checking existing connections...')
    const connections = node.getConnections(peerId)
    if (connections && connections.length > 0) {
      console.log(`Found ${connections.length} active connections`)
      for (const conn of connections) {
        const remoteAddr = conn.remoteAddr
        if (remoteAddr && !hasMultiAddr(remoteAddr, allMultiaddrs)) {
          console.log(`    + ${remoteAddr.toString()}`)
          allMultiaddrs.push(remoteAddr)
        }
      }
    } else {
      console.log('No existing connections to this peer')
    }
  } catch (e: any) {
    console.log('Could not check connections:', e.message)
  }

  console.log(`\nDiscovery summary: ${allMultiaddrs.length} total addresses found`)

  if (allMultiaddrs.length === 0) {
    const connectedPeers = node.getPeers()
    console.error(`No addresses found for peer ${peer}`)
    console.error(`Currently connected to ${connectedPeers.length} peers:`)
    connectedPeers
      .slice(0, 5)
      .forEach((p: any) => console.error(`     - ${p.toString()}`))
    throw new Error(
      `Could not discover any addresses for peer ${peer}. ` +
        `Connected to ${connectedPeers.length} peers in network. ` +
        `Ensure the target peer is online and accessible.`
    )
  }

  const wsAddrs = allMultiaddrs.filter((ma) => {
    const str = ma.toString()
    const isWs = str.includes('/ws') || str.includes('/wss')
    if (!isWs) {
      console.log(`  ⤷ Skipping non-WebSocket address: ${str}`)
    }
    return isWs
  })

  console.log(`WebSocket-compatible addresses: ${wsAddrs.length}`)

  if (wsAddrs.length === 0) {
    console.error(
      `Found ${allMultiaddrs.length} addresses but none use WebSocket protocol`
    )
    allMultiaddrs.forEach((ma) => console.error(`     - ${ma.toString()}`))
    throw new Error(
      `Peer ${peer} has no WebSocket addresses (required for browser). ` +
        `Found protocols: ${allMultiaddrs.map((ma: any) => ma.toString()).join(', ')}`
    )
  }

  return wsAddrs
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

    // Discover peer addresses via peerStore + DHT + connections
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
    console.log('Command completed\n')

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
    isWarmedUp = false
  }
}

export function getNodeInstance(): Libp2p | null {
  return nodeInstance
}

export function getConnectedPeerCount(): number {
  return nodeInstance?.getPeers().length || 0
}
