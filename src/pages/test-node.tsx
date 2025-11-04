import React, { useState } from 'react'
import { useP2P } from '@/contexts/P2PContext'

const TestNodePage: React.FC = () => {
  const [peerId, setPeerId] = useState(
    '16Uiu2HAmUKHMhLA8xUK8DuaqU3MSYEmYFVuFAtXmcYEsjdVDBPNg'
  )
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const { isReady, error: p2pError, getEnvs, connectedPeers } = useP2P()

  const handleTest = async () => {
    if (!isReady) {
      setError('Node not ready yet')
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

      {/* Simple status indicator */}
      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}
      >
        <strong>Node Status:</strong> {isReady ? '✅ Ready' : '⏳ Initializing...'}
        {isReady && (
          <>
            {' '}
            | <strong>Connected Peers:</strong> {connectedPeers}
          </>
        )}
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

      <button
        onClick={handleTest}
        disabled={loading || !peerId || !isReady}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: loading || !isReady ? 'not-allowed' : 'pointer',
          backgroundColor: loading || !isReady ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        {loading ? 'Testing...' : 'Test Connection'}
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
    </div>
  )
}

export default TestNodePage
