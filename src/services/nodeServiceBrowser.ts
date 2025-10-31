// Browser-only service that loads libp2p from CDN
declare global {
  interface Window {
    libp2pModules: any
  }
}

export async function loadLibp2pFromCDN(): Promise<void> {
  if (window.libp2pModules) {
    return
  }

  // Create a script to load libp2p modules from CDN
  const script = document.createElement('script')
  script.type = 'module'
  script.textContent = `
    import { createLibp2p } from 'https://esm.sh/libp2p@1.2.0';
    import { webSockets } from 'https://esm.sh/@libp2p/websockets@8.0.12';
    import { all } from 'https://esm.sh/@libp2p/websockets@8.0.12/filters';
    import { noise } from 'https://esm.sh/@chainsafe/libp2p-noise@15.0.0';
    import { yamux } from 'https://esm.sh/@chainsafe/libp2p-yamux@6.0.1';
    import { bootstrap } from 'https://esm.sh/@libp2p/bootstrap@10.0.10';
    import { kadDHT, passthroughMapper } from 'https://esm.sh/@libp2p/kad-dht@12.0.2';
    import { pipe } from 'https://esm.sh/it-pipe@3.0.1';
    import { fromString } from 'https://esm.sh/uint8arrays@5.0.1/from-string';
    import { toString } from 'https://esm.sh/uint8arrays@5.0.1/to-string';
    import { mdns } from 'https://esm.sh/@libp2p/mdns@10.1.1';
    import { peerIdFromString } from 'https://esm.sh/@libp2p/peer-id@4.1.4';



    // Create a permissive connection gater that allows all addresses (including localhost)
    const permissiveConnectionGater = {
      denyDialPeer: async () => false,
      denyDialMultiaddr: async () => false,
      denyInboundConnection: async () => false,
      denyOutboundConnection: async () => false,
      denyInboundEncryptedConnection: async () => false,
      denyOutboundEncryptedConnection: async () => false,
      denyInboundUpgradedConnection: async () => false,
      denyOutboundUpgradedConnection: async () => false,
      filterMultiaddrForPeer: async (peer) => peer.multiaddrs
    };

    window.libp2pModules = {
      createLibp2p,
      webSockets,
      all,
      noise,
      yamux,
      bootstrap,
      kadDHT,
      pipe,
      fromString,
      toString,
      permissiveConnectionGater,
      passthroughMapper,
      mdns,
      peerIdFromString
    };
    
    window.dispatchEvent(new Event('libp2p-loaded'));
  `

  document.head.appendChild(script)

  // Wait for modules to load
  return new Promise((resolve) => {
    window.addEventListener('libp2p-loaded', () => resolve(), { once: true })
  })
}

let nodeInstance: any = null
let multiaddrModule: any = null

// Load multiaddr from installed package (not CDN)
async function getMultiaddrConstructor() {
  if (multiaddrModule) {
    return multiaddrModule
  }
  const { multiaddr } = await import('@multiformats/multiaddr')
  multiaddrModule = multiaddr
  return multiaddr
}

async function ensureNodeStarted(bootstrapNodes: string[]) {
  // Load libp2p from CDN and create a singleton node instance
  await loadLibp2pFromCDN()
  const modules = window.libp2pModules
  if (!nodeInstance) {
    nodeInstance = await modules.createLibp2p({
      transports: [modules.webSockets({ filter: modules.all })],
      connectionEncryption: [modules.noise()],
      streamMuxers: [modules.yamux()],
      connectionGater: modules.permissiveConnectionGater,
      peerDiscovery: [
        modules.bootstrap({
          list: bootstrapNodes,
          timeout: 5000,
          tagName: 'bootstrap',
          tagValue: 50,
          tagTTL: 120000
        }),
        modules.mdns({ interval: 20e3 })
      ],
      services: {
        dht: modules.kadDHT({
          allowQueryWithZeroPeers: false,
          maxInboundStreams: 5,
          maxOutboundStreams: 50,
          pingConcurrency: 20,
          clientMode: true, // Read-only client
          protocol: '/ocean/nodes/1.0.0/kad/1.0.0',
          peerInfoMapper: modules.passthroughMapper
        })
      }
    })
    await nodeInstance.start()
  }
  return { node: nodeInstance, modules }
}

async function toMultiaddrArray(addrs: string[]) {
  const multiaddr = await getMultiaddrConstructor()
  const parsed: any[] = []
  for (const s of addrs) {
    try {
      parsed.push(multiaddr(s))
    } catch (e) {
      console.warn('Skipping invalid multiaddr:', s)
    }
  }
  return parsed
}

export async function getNodeEnvsBrowser(peerId: string, bootstrapNodes: string[]) {
  try {
    const { node, modules } = await ensureNodeStarted(bootstrapNodes)

    // Discover peer addresses via peerStore + DHT
    const discovered = await discoverPeerAddresses(node, peerId)

    if (discovered.length === 0) {
      throw new Error(`Could not find peer ${peerId} in peerStore or DHT`)
    }

    // Normalize multiaddrs and filter to WebSocket for browser
    const normalized = await normalizeMultiAddr(discovered, peerId)
    const wsMultiaddrs = normalized.filter((ma: any) => {
      const str = ma.toString()
      return str.includes('/ws') || str.includes('/wss')
    })

    if (wsMultiaddrs.length === 0) {
      throw new Error('No WebSocket addresses found for peer (browser requires WS)')
    }

    // Send command and get response
    const response = await sendCommandToPeer(node, modules, peerId, wsMultiaddrs, {
      command: 'getComputeEnvironments'
    })

    return JSON.parse(response)
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

export async function stopNodeBrowser() {
  if (nodeInstance) {
    await nodeInstance.stop()
    nodeInstance = null
  }
}

export async function sendP2PCommandBrowser(
  peerId: string,
  bootstrapNodes: string[],
  command: any
) {
  try {
    const { node, modules } = await ensureNodeStarted(bootstrapNodes)

    // Discover peer addresses
    const discovered = await discoverPeerAddresses(node, peerId)

    if (discovered.length === 0) {
      throw new Error(`Could not find peer ${peerId} in peerStore or DHT`)
    }

    // Normalize and filter to WebSocket
    const normalized = await normalizeMultiAddr(discovered, peerId)
    const wsMultiaddrs = normalized.filter((ma: any) => {
      const str = ma.toString()
      return str.includes('/ws') || str.includes('/wss')
    })

    if (wsMultiaddrs.length === 0) {
      throw new Error('No WebSocket addresses found for peer (browser requires WS)')
    }

    // Send command and get response
    return await sendCommandToPeer(node, modules, peerId, wsMultiaddrs, command)
  } catch (error) {
    console.error('Error sending P2P command:', error)
    throw error
  }
}

function hasMultiAddr(addr: any, multiAddresses: any[]) {
  for (let i = 0; i < multiAddresses.length; i++) {
    if (multiAddresses[i].toString() === addr.toString()) return true
  }
  return false
}

async function normalizeMultiAddr(multiAddrs: any, peerId: string) {
  const multiaddr = await getMultiaddrConstructor()
  const multiAddrsWithPeerId: any[] = []
  const multiAddrsWithoutPeerId: any[] = []

  for (const ma of multiAddrs) {
    const addrStr = typeof ma === 'string' ? ma : ma.toString()

    if (addrStr.includes(`/p2p/${peerId}`) || addrStr.endsWith(`/${peerId}`)) {
      try {
        multiAddrsWithPeerId.push(multiaddr(addrStr))
      } catch (e) {
        console.warn('Failed to parse multiaddr:', addrStr)
      }
    } else {
      let normalized = addrStr
      if (addrStr.includes('p2p-circuit')) {
        normalized = `${addrStr}/p2p/${peerId}`
      }

      try {
        multiAddrsWithoutPeerId.push(multiaddr(normalized))
      } catch (e) {
        console.warn('Failed to parse multiaddr without peerId:', normalized)
      }
    }
  }

  return multiAddrsWithPeerId.length > multiAddrsWithoutPeerId.length
    ? multiAddrsWithPeerId
    : multiAddrsWithoutPeerId
}

async function discoverPeerAddresses(node: any, peerId: string) {
  const multiaddr = await getMultiaddrConstructor()
  const allMultiaddrs: any[] = []

  let peerIdObj: any
  try {
    if (window.libp2pModules?.peerIdFromString) {
      peerIdObj = window.libp2pModules.peerIdFromString(peerId)
    }
  } catch (e) {
    console.error('Failed to parse peerId:', e)
    throw new Error(`Invalid peerId format: ${peerId}`)
  }

  try {
    const peerData = await node.peerStore.get(peerIdObj, {
      signal: AbortSignal.timeout(2000)
    })

    if (peerData && peerData.addresses) {
      for (const addr of peerData.addresses) {
        if (!hasMultiAddr(addr.multiaddr, allMultiaddrs)) {
          allMultiaddrs.push(addr.multiaddr)
        }
      }
    }
  } catch (e) {
    console.error('Error discovering peer addresses in PeerStore:', e)
  }

  if (allMultiaddrs.length === 0) {
    try {
      console.log('peerRouting', node.peerRouting)

      const peerInfo = await node.peerRouting.findPeer(peerIdObj, {
        signal: AbortSignal.timeout(10000),
        useCache: false,
        useNetwork: true
      })

      if (peerInfo && peerInfo.multiaddrs) {
        for (const addr of peerInfo.multiaddrs) {
          if (!hasMultiAddr(addr, allMultiaddrs)) {
            allMultiaddrs.push(addr)
            console.log('Found peer address via DHT:', addr.toString())
          }
        }
      }
    } catch (e) {
      console.error('Error discovering peer addresses via DHT:', e)
    }
  }

  if (allMultiaddrs.length === 0) {
    console.error('No peer addresses found for:', peerId)
    return []
  }

  return allMultiaddrs
}

async function dialWithRetry(
  node: any,
  multiaddrs: any[],
  peerId: string,
  maxRetries: number = 3,
  dialTimeout: number = 5000
): Promise<any> {
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      attempt += 1
      console.log(`Dial attempt ${attempt}/${maxRetries}`)

      if (node.components?.connectionManager?.dialQueue?.queue) {
        await node.components.connectionManager.dialQueue.queue.onSizeLessThan(10)
      }

      const options = {
        signal: AbortSignal.timeout(dialTimeout),
        priority: 100,
        runOnTransientConnection: true
      }

      const connection = await node.dial(multiaddrs, options)

      // Verify peer ID
      if (peerId && connection.remotePeer.toString() !== peerId) {
        connection.close()
        throw new Error(
          `Invalid peer: expected ${peerId}, got ${connection.remotePeer.toString()}`
        )
      }

      console.log('Successfully connected to peer')
      return connection
    } catch (e: any) {
      if (attempt >= maxRetries) {
        throw new Error(
          e.message
            ? `Cannot connect to peer after ${maxRetries} attempts: ${e.message}`
            : 'Cannot connect to peer after multiple attempts'
        )
      }
      console.warn(`Dial attempt ${attempt} failed:`, e.message)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }

  throw new Error('Failed to establish connection')
}

async function sendCommandToPeer(
  node: any,
  modules: any,
  peerId: string,
  multiaddrs: any[],
  command: any
): Promise<string> {
  // Dial with retry
  const connection = await dialWithRetry(node, multiaddrs, peerId)

  try {
    // Open stream
    const stream = await connection.newStream('/ocean/nodes/1.0.0', {
      signal: AbortSignal.timeout(5000)
    })

    try {
      // Send command and receive response
      const message = JSON.stringify(command)
      let response = ''
      let firstChunk = true

      await modules.pipe(
        [modules.fromString(message)],
        stream,
        async function (source: any) {
          for await (const chunk of source) {
            const str = modules.toString(chunk.subarray())

            if (firstChunk) {
              firstChunk = false
              // Skip first chunk if it's status metadata
              try {
                const parsed = JSON.parse(str)
                if (parsed.httpStatus !== undefined) {
                  console.log('Skipped status chunk:', str)
                  continue
                }
              } catch (e) {}
            }

            response += str
          }
        }
      )

      return response
    } finally {
      // Cleanup stream
      try {
        await stream.close()
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } finally {
    // Cleanup connection
    try {
      connection.close()
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
