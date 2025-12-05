# Next.js Server-Side P2P Solution

## Overview

Instead of using a separate WebSocket proxy, this solution runs the libp2p node **on the Next.js server** and exposes HTTPS API endpoints for the client to interact with peers.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (HTTPS)                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │  React Components                                   │     │
│  │  - Use useP2P() hook                               │     │
│  │  - Call sendCommand(), getEnvs()                   │     │
│  └────────────────┬───────────────────────────────────┘     │
│                   │ HTTPS API Calls                          │
└───────────────────┼──────────────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────┐
│              Next.js Server (Node.js)                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  API Routes (/api/p2p/*)                           │     │
│  │  - POST /api/p2p/command                           │     │
│  │  - GET  /api/p2p/envs                              │     │
│  │  - GET  /api/p2p/status                            │     │
│  └────────────────┬───────────────────────────────────┘     │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐     │
│  │  libp2p Node (Server-Side)                         │     │
│  │  - Runs in Node.js (WS allowed)                    │     │
│  │  - Connects to Ocean nodes via WS                  │     │
│  │  - Singleton instance shared across requests       │     │
│  └────────────────┬───────────────────────────────────┘     │
└───────────────────┼──────────────────────────────────────────┘
                    │ WS Connections (allowed server-side)
┌───────────────────▼──────────────────────────────────────────┐
│           Ocean Protocol Nodes (WS)                          │
│  - node1.oceanprotocol.com:9001                             │
│  - node2.oceanprotocol.com:9001                             │
│  - node3.oceanprotocol.com:9001                             │
│  - node4.oceanprotocol.com:9001                             │
└──────────────────────────────────────────────────────────────┘
```

## Benefits

✅ **No separate infrastructure** - Everything in one Next.js deployment  
✅ **No mixed content issues** - Client only uses HTTPS  
✅ **Simpler deployment** - Just deploy to Vercel as usual  
✅ **Better debugging** - All logs in one place  
✅ **No CORS issues** - Same origin for API calls  
✅ **Server-side caching** - Can cache peer connections  
✅ **Better error handling** - Centralized error management  

## Files Created

### API Routes (Server-Side)

1. **`src/pages/api/p2p/command.ts`**
   - POST endpoint for sending commands to peers
   - Handles peer discovery and communication
   - Returns results to client

2. **`src/pages/api/p2p/envs.ts`**
   - GET endpoint for fetching compute environments
   - Convenience wrapper for common operation

3. **`src/pages/api/p2p/status.ts`**
   - GET endpoint for checking node status
   - Returns connection info, peer count, etc.

### Client-Side Services

4. **`src/services/p2pApiService.ts`**
   - Client-side service for calling API routes
   - Clean interface for browser code
   - Handles errors and retries

5. **`src/contexts/P2PContext.api.tsx`**
   - Updated context using API routes
   - Drop-in replacement for original P2PContext
   - Same interface, different implementation

## Implementation Steps

### Step 1: Use the API-Based Context

Replace your current P2PContext import:

```typescript
// Before:
import { P2PProvider, useP2P } from '@/contexts/P2PContext';

// After:
import { P2PProvider, useP2P } from '@/contexts/P2PContext.api';
```

Or rename the file:
```bash
mv src/contexts/P2PContext.tsx src/contexts/P2PContext.client.tsx
mv src/contexts/P2PContext.api.tsx src/contexts/P2PContext.tsx
```

### Step 2: Update Your Components

Your component code **doesn't need to change**! The API is the same:

```typescript
function MyComponent() {
  const { isReady, sendCommand, getEnvs } = useP2P();

  const handleGetEnvs = async (peerId: string) => {
    if (!isReady) {
      console.log('Node not ready yet');
      return;
    }

    try {
      const envs = await getEnvs(peerId);
      console.log('Environments:', envs);
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  return (
    <div>
      <p>Status: {isReady ? 'Ready' : 'Initializing...'}</p>
      {/* Your UI */}
    </div>
  );
}
```

### Step 3: Deploy

Just deploy to Vercel as usual:

```bash
git add .
git commit -m "Use server-side P2P API"
git push
```

That's it! No environment variables, no proxy deployment, no extra configuration.

## How It Works

### Server-Side Node Initialization

The libp2p node is initialized **once** when the first API request comes in:

```typescript
// Server-side singleton
let serverNodeInitialized = false;

async function ensureNodeInitialized() {
  if (!serverNodeInitialized) {
    await initializeNode(OCEAN_BOOTSTRAP_NODES);
    serverNodeInitialized = true;
  }
}
```

The node persists across requests (serverless function warm starts).

### Client-Side API Calls

The client makes simple HTTPS requests:

```typescript
// Client sends HTTPS POST
const response = await fetch('/api/p2p/command', {
  method: 'POST',
  body: JSON.stringify({ peerId, command }),
});

// Server handles P2P communication
// Returns result as JSON
const result = await response.json();
```

### Status Polling

The context polls the status endpoint to track node readiness:

```typescript
// Check status every 10 seconds
setInterval(async () => {
  const status = await getNodeStatusAPI();
  setIsReady(status.ready);
  setConnectedPeers(status.connectedPeers);
}, 10000);
```

## API Endpoints

### POST /api/p2p/command

Send a command to a peer.

**Request:**
```json
{
  "peerId": "16Uiu2HAmLhRDqfufZiQnxvQs2XHhd6hwkLSPfjAQg1gH8wgRixiP",
  "command": {
    "command": "getComputeEnvironments",
    "node": "16Uiu2HAmLhRDqfufZiQnxvQs2XHhd6hwkLSPfjAQg1gH8wgRixiP"
  },
  "protocol": "/ocean/nodes/1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Command result
  }
}
```

### GET /api/p2p/envs?peerId=...

Get compute environments from a peer.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "env-1",
      "name": "Environment 1",
      // ...
    }
  ]
}
```

### GET /api/p2p/status

Get server-side node status.

**Response:**
```json
{
  "initialized": true,
  "ready": true,
  "peerId": "16Uiu2HAm...",
  "connectedPeers": 3,
  "addresses": [
    "/ip4/127.0.0.1/tcp/0/ws/p2p/16Uiu2HAm..."
  ]
}
```

## Serverless Considerations

### Cold Starts

On Vercel, serverless functions may have cold starts:
- First request after idle: ~2-5 seconds (node initialization)
- Subsequent requests: <100ms (warm function)

The context handles this gracefully with status polling.

### Function Timeout

Default Vercel timeout: 10 seconds (Hobby), 60 seconds (Pro)

If you need longer timeouts for slow peers:
```typescript
// vercel.json
{
  "functions": {
    "src/pages/api/p2p/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Memory

libp2p needs ~128MB RAM. Vercel provides 1GB by default (plenty).

## Comparison: Proxy vs Server-Side API

| Feature | WebSocket Proxy | Server-Side API |
|---------|----------------|-----------------|
| **Deployment** | Separate (Cloudflare/etc) | Same as app |
| **Infrastructure** | 2 services | 1 service |
| **Complexity** | Medium | Low |
| **Latency** | Extra hop | Direct |
| **Cost** | Free tier limits | Included in Vercel |
| **Debugging** | Separate logs | Unified logs |
| **CORS** | Potential issues | No issues |
| **Caching** | Limited | Full control |

## Monitoring

### Server Logs

View logs in Vercel dashboard or CLI:
```bash
vercel logs
```

Look for:
```
[API] Initializing server-side libp2p node...
[API] Server-side node initialized successfully
[API] Sending command to peer 16Uiu2...
```

### Client Logs

Browser console shows:
```
P2PContext: Waiting for server-side node to be ready...
Waiting for node... (0 peers connected)
Waiting for node... (1 peers connected)
✓ Server-side node is ready
P2PContext: Server-side node ready
```

## Troubleshooting

### "Node not ready"

**Cause:** Server-side node still initializing

**Solution:** Wait for `isReady` to be `true`, or check status endpoint

### "Function timeout"

**Cause:** Peer discovery taking too long

**Solutions:**
- Increase timeout in `vercel.json`
- Optimize peer discovery logic
- Add caching for known peers

### "Cold start slow"

**Cause:** Serverless function cold start

**Solutions:**
- Accept it (only first request)
- Use Vercel Pro (faster cold starts)
- Keep function warm with periodic pings

## Advanced: Caching Peer Connections

You can cache peer connections to speed up subsequent requests:

```typescript
// In API route
const peerConnectionCache = new Map();

async function getOrCreateConnection(peerId: string) {
  if (peerConnectionCache.has(peerId)) {
    return peerConnectionCache.get(peerId);
  }
  
  const connection = await node.dial(peerId);
  peerConnectionCache.set(peerId, connection);
  return connection;
}
```

## Migration Checklist

- [ ] Copy API routes to `src/pages/api/p2p/`
- [ ] Copy `p2pApiService.ts` to `src/services/`
- [ ] Update `P2PContext` to use API version
- [ ] Test locally (`npm run dev`)
- [ ] Deploy to Vercel
- [ ] Verify in production
- [ ] Monitor logs for errors

## Next Steps

1. ✅ Implement the API routes
2. ✅ Update P2PContext
3. ✅ Test locally
4. ✅ Deploy to Vercel
5. ✅ Monitor and optimize

---

**This is the recommended approach** for Next.js apps. It's simpler, more maintainable, and works seamlessly with Vercel's infrastructure.
