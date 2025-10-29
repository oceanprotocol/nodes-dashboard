import type { NextApiRequest, NextApiResponse } from 'next'
import type { Libp2p } from 'libp2p'
import type { Connection, Stream } from '@libp2p/interface'

// Polyfill for Promise.withResolvers (required for Node.js < 22)
if (typeof Promise.withResolvers === 'undefined') {
  // @ts-ignore
  Promise.withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void
    let reject: (reason?: any) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    // @ts-ignore
    return { promise, resolve, reject }
  }
}

// Connection storage (in-memory, per-process)
interface ConnectionInfo {
  node: Libp2p
  connection: Connection
  createdAt: number
}

const connections = new Map<string, ConnectionInfo>()
const CONNECTION_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const { action, addr, command, connectionId } = req.body

  try {
    // Handle 'connect' action
    if (action === 'connect') {
      if (!addr) {
        res.status(400).json({ error: 'addr required for connect action' })
        return
      }

      // Check if already connected
      if (connections.has(addr)) {
        res.status(200).json({ connectionId: addr, message: 'Already connected' })
        return
      }

      const { createLibp2p } = await import('libp2p')
      const { webSockets } = await import('@libp2p/websockets')
      const { noise } = await import('@chainsafe/libp2p-noise')
      const { yamux } = await import('@chainsafe/libp2p-yamux')
      const { multiaddr } = await import('@multiformats/multiaddr')

      const node = await createLibp2p({
        transports: [webSockets()],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()]
      })

      await node.start()

      try {
        const connection = await node.dial(multiaddr(addr))

        connections.set(addr, {
          node,
          connection,
          createdAt: Date.now()
        })

        // Auto-cleanup after timeout
        setTimeout(async () => {
          const connInfo = connections.get(addr)
          if (connInfo) {
            try {
              await connInfo.connection.close()
              await connInfo.node.stop()
            } catch (error) {
              console.error('Error during auto-cleanup:', error)
            } finally {
              connections.delete(addr)
            }
          }
        }, CONNECTION_TIMEOUT)

        res.status(200).json({ connectionId: addr, message: 'Connected successfully' })
      } catch (error) {
        await node.stop()
        throw error
      }
    }
    // Handle 'command' action
    else if (action === 'command') {
      if (!connectionId) {
        res.status(400).json({ error: 'connectionId required for command action' })
        return
      }

      const connInfo = connections.get(connectionId)
      if (!connInfo) {
        res.status(404).json({ error: 'Connection not found. Please connect first.' })
        return
      }

      const { pipe } = await import('it-pipe')
      const { fromString: u8From } = await import('uint8arrays/from-string')
      const { toString: u8To } = await import('uint8arrays/to-string')

      // Create a new stream for each command (streams are single-use)
      const stream = await connInfo.connection.newStream('/ocean/nodes/1.0.0')

      let header: any = null
      let body = ''

      try {
        // Send the command
        await pipe(
          [u8From(JSON.stringify(command || { command: 'status' }))],
          stream.sink
        )

        // Close the write side to signal we're done sending
        await stream.closeWrite()

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Command timeout after 30 seconds')), 30000)
        })

        // Read the response
        const readPromise = (async () => {
          let first = true
          for await (const chunk of stream.source) {
            const str = u8To(chunk.subarray())
            if (first) {
              first = false
              try {
                header = JSON.parse(str)
              } catch {}
              continue
            }
            console.log("str=", str)
            body += str
          }
        })()

        await Promise.race([readPromise, timeoutPromise])

        res.status(200).json({ header, body })
      } catch (error: any) {
        // Close the stream on error
        try {
          await stream.close()
        } catch {}
        throw error
      }
    }
    // Handle 'disconnect' action
    else if (action === 'disconnect') {
      if (!connectionId) {
        res.status(400).json({ error: 'connectionId required for disconnect action' })
        return
      }

      const connInfo = connections.get(connectionId)
      if (!connInfo) {
        res.status(404).json({ error: 'Connection not found' })
        return
      }

      try {
        await connInfo.connection.close()
        await connInfo.node.stop()
      } catch (error) {
        console.error('Error disconnecting:', error)
      } finally {
        connections.delete(connectionId)
      }

      res.status(200).json({ message: 'Disconnected successfully' })
    }
    // Handle 'list' action
    else if (action === 'list') {
      const activeConnections = Array.from(connections.keys())
      res.status(200).json({ connections: activeConnections })
    }
    else {
      res.status(400).json({ error: 'Invalid action. Use: connect, command, disconnect, or list' })
    }
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
}
