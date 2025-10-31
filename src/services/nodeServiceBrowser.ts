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
    import { identify } from 'https://esm.sh/@libp2p/identify@1.0.9';
    import { kadDHT } from 'https://esm.sh/@libp2p/kad-dht@12.0.2';
    import { pipe } from 'https://esm.sh/it-pipe@3.0.1';
    import { fromString } from 'https://esm.sh/uint8arrays@5.0.1/from-string';
    import { toString } from 'https://esm.sh/uint8arrays@5.0.1/to-string';

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
      identify,
      kadDHT,
      pipe,
      fromString,
      toString,
      permissiveConnectionGater
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
    console.log('connectioNGater=', modules.permissiveConnectionGater)
    nodeInstance = await modules.createLibp2p({
      transports: [modules.webSockets({ filter: modules.all })],
      connectionEncryption: [modules.noise()],
      streamMuxers: [modules.yamux()],
      connectionGater: modules.permissiveConnectionGater,
      peerDiscovery: [
        modules.bootstrap({
          list: bootstrapNodes,
          timeout: 5000
        })
      ],
      services: {
        identify: modules.identify(),
        dht: modules.kadDHT({
          clientMode: true,
          protocol: '/ocean/nodes/1.0.0/kad/1.0.0'
        })
      }
    })
    await nodeInstance.start()
  }
  return { node: nodeInstance, modules }
}

function filterBrowserDialableAddrs(multiAddrs: any[], peerId?: string) {
  const result: string[] = []
  for (const ma of multiAddrs) {
    const s = typeof ma === 'string' ? ma : ma.toString()
    if (!s.includes('/ws') && !s.includes('/wss')) continue
    if (s.includes('p2p-circuit') && peerId && !s.includes(`/p2p/${peerId}`)) {
      try {
        result.push(s.endsWith(`/${peerId}`) ? s : `${s}/p2p/${peerId}`)
      } catch {}
    } else {
      result.push(s)
    }
  }
  return result
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

export async function getNodeEnvsBrowser(
  peerId: string,
  bootstrapNodes: string[],
  directAddress?: string
) {
  try {
    const { node, modules } = await ensureNodeStarted(bootstrapNodes)
    let multiAddrs: any[]

    if (directAddress) {
      console.log('Using direct address:', directAddress)
      const multiaddr = await getMultiaddrConstructor()
      try {
        const parsed = multiaddr(directAddress)
        multiAddrs = [parsed]
      } catch (parseError: any) {
        console.error(
          'Failed to parse direct address:',
          directAddress,
          parseError.message
        )
        throw new Error(
          `Invalid multiaddr format: ${directAddress}. Error: ${parseError.message}`
        )
      }
    } else {
      // Try to find peer via DHT
      console.log('Searching for peer via DHT:', peerId)
      try {
        const peerInfo = await node.peerRouting.findPeer(peerId, {
          signal: AbortSignal.timeout(10000)
        })
        const discovered = peerInfo.multiaddrs || []
        const filtered = filterBrowserDialableAddrs(discovered, peerId)
        multiAddrs = await toMultiaddrArray(filtered)
        console.log('Found peer WS addresses via DHT:', filtered)
      } catch (dhtError) {
        console.error('DHT lookup failed:', dhtError)
        throw new Error(
          `Could not find peer ${peerId} in DHT. Try providing a direct address.`
        )
      }
    }

    if (!multiAddrs || multiAddrs.length === 0) {
      throw new Error('No addresses found for peer')
    }

    const connection = await node.dial(multiAddrs, {
      signal: AbortSignal.timeout(5000)
    })

    // Verify peer ID if we connected
    if (connection.remotePeer.toString() !== peerId) {
      console.warn(
        `Connected peer (${connection.remotePeer.toString()}) doesn't match expected (${peerId})`
      )
    }

    const stream = await connection.newStream('/ocean/nodes/1.0.0', {
      signal: AbortSignal.timeout(3000)
    })

    const message = JSON.stringify({ command: 'getComputeEnvironments' })
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
            // Skip first chunk if it's status metadata (like {"httpStatus":200})
            try {
              const parsed = JSON.parse(str)
              // If it has httpStatus, it's metadata - skip it
              if (parsed.httpStatus !== undefined) {
                console.log('Skipped status chunk:', str)
                continue
              }
            } catch (e) {
              // Not valid JSON, include it in response
            }
          }

          response += str
        }
      }
    )

    console.log('response from node=', response)

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
  command: any,
  directAddress?: string
) {
  const { node, modules } = await ensureNodeStarted(bootstrapNodes)

  let multiAddrs: any[]
  if (directAddress) {
    const multiaddr = await getMultiaddrConstructor()
    try {
      multiAddrs = [multiaddr(directAddress)]
    } catch (parseError: any) {
      throw new Error(
        `Invalid multiaddr format: ${directAddress}. Error: ${parseError.message}`
      )
    }
  } else {
    const peerInfo = await node.peerRouting.findPeer(peerId, {
      signal: AbortSignal.timeout(10000)
    })
    const filtered = filterBrowserDialableAddrs(peerInfo.multiaddrs || [], peerId)
    multiAddrs = await toMultiaddrArray(filtered)
  }

  if (!multiAddrs || multiAddrs.length === 0) {
    throw new Error('No addresses found for peer')
  }

  console.log(
    'Dialing with multiaddrs:',
    multiAddrs.map((ma: any) => ma.toString())
  )
  const connection = await node.dial(multiAddrs, {
    signal: AbortSignal.timeout(5000)
  })

  // Verify peer ID if we connected
  if (connection.remotePeer.toString() !== peerId) {
    console.warn(
      `Connected peer (${connection.remotePeer.toString()}) doesn't match expected (${peerId})`
    )
  }

  const stream = await connection.newStream('/ocean/nodes/1.0.0', {
    signal: AbortSignal.timeout(5000)
  })

  const message = JSON.stringify(command)
  let response = ''
  let firstChunk = true

  await modules.pipe([modules.fromString(message)], stream, async function (source: any) {
    for await (const chunk of source) {
      const str = modules.toString(chunk.subarray())

      if (firstChunk) {
        firstChunk = false
        // Skip first chunk
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
  })

  return response
}
