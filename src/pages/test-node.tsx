import React, { useState, useEffect } from 'react'
import type { GetServerSideProps } from 'next'

declare global {
  interface Window {
    OCEAN_BOOTSTRAP_NODES: string[]
  }
}

const TestNodePage: React.FC = () => {
  const [mounted, setMounted] = useState(false)
  const [getNodeEnvs, setGetNodeEnvs] = useState<any>(null)
  const [peerId, setPeerId] = useState(
    '16Uiu2HAmUKHMhLA8xUK8DuaqU3MSYEmYFVuFAtXmcYEsjdVDBPNg'
  )
  const [directAddress, setDirectAddress] = useState(
    '/ip4/127.0.0.1/tcp/54520/ws/p2p/16Uiu2HAmUKHMhLA8xUK8DuaqU3MSYEmYFVuFAtXmcYEsjdVDBPNg'
  )
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    import('@/shared/consts/bootstrapNodes').then((mod) => {
      window.OCEAN_BOOTSTRAP_NODES = mod.OCEAN_BOOTSTRAP_NODES

      const cdnGetNodeEnvs = async (peerId: string, directAddr?: string) => {
        // Import bundled version instead of CDN version
        const { getNodeEnvs } = await import('../services/nodeService')
        return getNodeEnvs(peerId, window.OCEAN_BOOTSTRAP_NODES)
      }

      setGetNodeEnvs(() => cdnGetNodeEnvs)
      setMounted(true)
    })
  }, [])

  const handleTest = async () => {
    if (!getNodeEnvs) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('Testing connection to peer:', peerId)
      console.log('Direct address:', directAddress)
      const data = await getNodeEnvs(peerId, directAddress || undefined)
      console.log('Received data:', data)
      setResult(data)
    } catch (err: any) {
      console.error('Test failed:', err)
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Ocean Node Test</h1>
        <p>Loading client-side modules...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Ocean Node Test</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <strong>Peer ID:</strong>
          <br />
          <input
            type="text"
            value={peerId}
            onChange={(e) => setPeerId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginTop: '8px',
              fontFamily: 'monospace'
            }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <strong>Direct Address (optional, but recommended for local nodes):</strong>
          <br />
          <input
            type="text"
            value={directAddress}
            onChange={(e) => setDirectAddress(e.target.value)}
            placeholder="/ip4/127.0.0.1/tcp/54520/ws/p2p/[PEER_ID]"
            style={{
              width: '100%',
              padding: '8px',
              marginTop: '8px',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}
          />
        </label>
        <small style={{ color: '#666' }}>
          For local nodes, use the WebSocket address with /ws in it
        </small>
      </div>

      <button
        onClick={handleTest}
        disabled={loading || !peerId || !getNodeEnvs}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: loading ? 'wait' : 'pointer',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        {loading ? 'Testing...' : 'Test Connection'}
      </button>

      {loading && (
        <div style={{ marginTop: '20px', color: '#666' }}>
          <p>Initializing libp2p node...</p>
          <p>Connecting to bootstrap nodes...</p>
          <p>Querying peer...</p>
        </div>
      )}

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
          <strong>Success! Result:</strong>
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
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}
      >
        <h3>Instructions:</h3>
        <ol>
          <li>Make sure your local Ocean node is running</li>
          <li>Verify it has a WebSocket endpoint (check which port has /ws)</li>
          <li>Update the bootstrap address port if needed</li>
          <li>Open browser console (F12) to see detailed logs</li>
          <li>Click &quot;Test Connection&quot; to query the node</li>
        </ol>
      </div>
    </div>
  )
}

// Disable SSR for this page - libp2p only works in browser
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  }
}

export default TestNodePage
