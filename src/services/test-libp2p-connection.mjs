// Polyfill for Promise.withResolvers (for Node.js < 22)
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { identify } from '@libp2p/identify'

async function testBootstrapDiscovery() {
  console.log('🧪 Testing Bootstrap Discovery from Node.js...\n')

  const bootstrapNodes = [
    '/ip4/127.0.0.1/tcp/49757/ws/p2p/16Uiu2HAmUKHMhLA8xUK8DuaqU3MSYEmYFVuFAtXmcYEsjdVDBPNg',
    '/ip4/127.0.0.1/tcp/9001/ws/p2p/16Uiu2HAmRkJeRYRghP3ETQCpdz8NsQzQE9RpSST7i5YNgWqH4dVE'
  ]

  console.log('Bootstrap nodes:')
  bootstrapNodes.forEach((addr, i) => {
    console.log(`  ${i + 1}. ${addr}`)
  })
  console.log('')

  // Create node with bootstrap discovery (like browser version)
  const node = await createLibp2p({
    transports: [webSockets()],
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
      identify: identify()
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

  // Event listeners
  node.addEventListener('peer:discovery', (evt) => {
    console.log(`🔍 Discovered peer: ${evt.detail.id.toString()}`)
  })

  node.addEventListener('peer:connect', (evt) => {
    console.log(`✅ CONNECTED to peer: ${evt.detail.toString()}`)
  })

  node.addEventListener('peer:disconnect', (evt) => {
    console.log(`⚠️ Disconnected from peer: ${evt.detail.toString()}`)
  })

  await node.start()
  console.log('✓ Node started with bootstrap discovery\n')
  console.log('⏳ Waiting for bootstrap discovery and auto-dial...\n')

  // Monitor for 20 seconds
  const monitorInterval = setInterval(async () => {
    const peers = node.getPeers()
    const connections = node.getConnections()

    console.log(`📊 Status: ${peers.length} peer(s), ${connections.length} connection(s)`)

    if (peers.length > 0) {
      peers.forEach((p) => {
        const conns = node.getConnections(p)
        console.log(`   - ${p.toString()}: ${conns.length} connection(s)`)
      })
    }

    // Check peerStore
    const allPeers = await node.peerStore.all()
    console.log(`   PeerStore: ${allPeers.length} peer(s)`)
    if (allPeers.length > 0) {
      allPeers.forEach((peerData) => {
        const addrCount = peerData.addresses?.length || 0
        console.log(`     - ${peerData.id.toString()}: ${addrCount} address(es)`)
      })
    }
    console.log('')
  }, 3000)

  // Wait 20 seconds
  await new Promise((resolve) => setTimeout(resolve, 20000))

  clearInterval(monitorInterval)

  const finalPeers = node.getPeers()
  const finalConns = node.getConnections()

  console.log('\n' + '='.repeat(50))
  console.log('FINAL RESULTS:')
  console.log('='.repeat(50))
  console.log(`Connected peers: ${finalPeers.length}`)
  console.log(`Total connections: ${finalConns.length}`)

  if (finalPeers.length > 0) {
    console.log('\n✅ SUCCESS: Bootstrap discovery and auto-dial worked!')
    finalPeers.forEach((p) => {
      console.log(`   ✓ ${p.toString()}`)
    })
  } else {
    console.log('\n❌ FAILED: No connections established via bootstrap discovery')
    console.log('This indicates the same issue as the browser version')
  }

  await node.stop()
  console.log('\n✓ Test complete')
}

testBootstrapDiscovery().catch((error) => {
  console.error('\n❌ Test failed with error:')
  console.error(error)
  process.exit(1)
})
