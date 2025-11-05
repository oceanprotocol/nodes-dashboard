import React, { useState, useEffect } from 'react'
import { useP2P } from '@/contexts/P2PContext'

const TestNodePage: React.FC = () => {
  const [peerId, setPeerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [availablePeers, setAvailablePeers] = useState<string[]>([])

  const { isReady, error: p2pError, getEnvs, node } = useP2P()

  // Discover available Ocean nodes
  const discoverPeers = async () => {
    if (!node || !isReady) return

    setDiscovering(true)
    try {
      // Get all known peers from peerStore
      const allPeers = await node.peerStore.all()

      // Filter for peers that support the Ocean protocol
      const oceanPeers: string[] = []
      for (const peer of allPeers) {
        if (peer.protocols && peer.protocols.includes('/ocean/nodes/1.0.0')) {
          oceanPeers.push(peer.id.toString())
        }
      }

      console.log(`Found ${oceanPeers.length} Ocean nodes that support the protocol`)
      setAvailablePeers(oceanPeers)
    } catch (err: any) {
      console.error('Discovery failed:', err)
      setError(err.message)
    } finally {
      setDiscovering(false)
    }
  }

  useEffect(() => {
    if (isReady) {
      // Give it a few seconds for connections to establish, then discover
      const timer = setTimeout(() => {
        discoverPeers()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isReady])

  const handleTest = async () => {
    if (!isReady || !peerId) {
      setError('Node not ready or no peer selected')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('Testing connection to peer:', peerId)
      const data = await getEnvs(peerId)
      console.log('Received data:', data)
      setResult(data)
    } catch (err: any) {
      console.error('Test failed:', err)
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Ocean Node Test</h1>

      {/* Status indicator */}
      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}
      >
        <strong>Node Status:</strong> {isReady ? '✅ Ready' : '⏳ Initializing...'}
      </div>

      {p2pError && (
        <div
          style={{
            padding: '15px',
            marginBottom: '20px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px'
          }}
        >
          <strong>P2P Error:</strong> {p2pError}
        </div>
      )}

      {/* Discovered Ocean Nodes */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <strong>Available Ocean Nodes ({availablePeers.length}):</strong>
          <button
            onClick={discoverPeers}
            disabled={!isReady || discovering}
            style={{ marginLeft: '10px', padding: '5px 10px', cursor: 'pointer' }}
          >
            {discovering ? 'Discovering...' : 'Refresh'}
          </button>
        </div>

        {availablePeers.length > 0 ? (
          <div
            style={{
              border: '1px solid #ccc',
              borderRadius: '4px',
              maxHeight: '200px',
              overflow: 'auto'
            }}
          >
            {availablePeers.map((peer) => (
              <div
                key={peer}
                onClick={() => setPeerId(peer)}
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  backgroundColor: peerId === peer ? '#e3f2fd' : 'white',
                  borderBottom: '1px solid #eee',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              >
                {peer}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '10px', color: '#666', fontStyle: 'italic' }}>
            {discovering
              ? 'Discovering peers...'
              : 'No Ocean nodes discovered yet. They will appear as connections are established.'}
          </div>
        )}
      </div>

      {/* Manual peer ID input */}
      <div style={{ marginBottom: '20px' }}>
        <label>
          <strong>Or enter Peer ID manually:</strong>
          <br />
          <input
            type="text"
            value={peerId}
            onChange={(e) => setPeerId(e.target.value)}
            placeholder="16Uiu2HAm..."
            style={{
              width: '100%',
              padding: '8px',
              marginTop: '8px',
              fontFamily: 'monospace'
            }}
          />
        </label>
      </div>

      <button
        onClick={handleTest}
        disabled={loading || !peerId || !isReady}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: loading || !isReady || !peerId ? 'not-allowed' : 'pointer',
          backgroundColor: loading || !isReady || !peerId ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        {loading ? 'Testing...' : 'Get Environments'}
      </button>

      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px'
          }}
        >
          <strong>Error:</strong>
          <pre style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>{error}</pre>
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#efe',
            border: '1px solid #cfc',
            borderRadius: '4px'
          }}
        >
          <strong>Success! Environments:</strong>
          <pre
            style={{
              marginTop: '10px',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '4px'
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div
        style={{
          marginTop: '40px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          borderRadius: '4px'
        }}
      >
        <h3>⚠️ Important:</h3>
        <ul>
          <li>
            <strong>Bootstrap nodes</strong> (like node1.oceanprotocol.com) only help with
            peer discovery
          </li>
          <li>You cannot send commands to bootstrap nodes</li>
          <li>
            Wait for the node to discover <strong>regular Ocean nodes</strong> through the
            bootstrap nodes
          </li>
          <li>Then send commands to those discovered nodes</li>
          <li>Your local node (127.0.0.1) should work if its a regular Ocean node</li>
        </ul>
      </div>
    </div>
  )
}

export default TestNodePage
