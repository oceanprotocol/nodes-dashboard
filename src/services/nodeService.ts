import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { createLibp2p, Libp2p } from 'libp2p'
import { pipe } from 'it-pipe'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { bootstrap } from '@libp2p/bootstrap'
import { identify } from '@libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'
import { OCEAN_BOOTSTRAP_NODES } from '@/shared/consts/bootstrapNodes'

export class OceanClientNode {
  private node: any
  async initialize() {
    this.node = await createLibp2p({
      transports: [webSockets({ filter: all })],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [
        bootstrap({
          list: OCEAN_BOOTSTRAP_NODES,
          timeout: 5000
        })
      ],
      services: {
        identify: identify(),
        dht: kadDHT({
          clientMode: true, // read-only
          protocol: '/ocean/nodes/1.0.0/kad/1.0.0'
        })
      }
    })

    await this.node.start()
    console.log('Node client started')
  }

  async findNode(peerId: string) {
    try {
      // Query DHT for this peer's addresses
      const peerInfo = await this.node.peerRouting.findPeer(peerId, {
        signal: AbortSignal.timeout(5000)
      })

      return {
        id: peerInfo.id.toString(),
        addresses: peerInfo.multiaddrs.map((ma: any) => ma.toString())
      }
    } catch (error) {
      console.error('Peer not found:', error)
      return null
    }
  }

  async sendCommand(peerId: string, command: any) {
    try {
      const peerInfo = await this.node.peerRouting.findPeer(peerId, {
        signal: AbortSignal.timeout(5000)
      })
      const multiAddrs = peerInfo.multiaddrs

      if (multiAddrs.length === 0) {
        throw new Error('No addresses found for peer')
      }
      const connection = await this.node.dial(multiAddrs, {
        signal: AbortSignal.timeout(5000)
      })

      // Open a new stream to the peer
      const stream = await connection.newStream('/ocean/nodes/1.0.0', {
        signal: AbortSignal.timeout(3000)
      })

      const message = JSON.stringify(command)
      let response = ''
      await pipe([fromString(message)], stream, async function (source) {
        for await (const chunk of source) {
          response += toString(chunk.subarray())
        }
      })

      return JSON.parse(response)
    } catch (error) {
      console.error('Error sending command:', error)
      throw error
    }
  }
  async stop() {
    if (this.node) {
      await this.node.stop()
    }
  }
}
