# Testing Server-Side P2P Initialization

## Issue Fixed

The node was showing `{"initialized":false,"ready":false}` because:
1. Each API route had its own separate initialization flag
2. The status endpoint didn't trigger initialization
3. No shared state between API routes

## Solution Implemented

### 1. Created Shared Service (`src/services/p2pNodeService.ts`)
- Manages singleton libp2p instance
- Shared initialization state across all API routes
- Prevents duplicate initialization attempts

### 2. Updated All API Routes
- **`/api/p2p/command`** - Uses shared service
- **`/api/p2p/envs`** - Uses shared service  
- **`/api/p2p/status`** - Triggers initialization automatically
- **`/api/p2p/init`** - NEW: Explicit initialization endpoint

### 3. Updated Client Context
- Calls `/api/p2p/init` on startup
- Waits for initialization to complete
- Then polls status for updates

## How to Test

### 1. Check Status Endpoint

Open your browser and navigate to:
```
http://localhost:3000/api/p2p/status
```

You should see initialization start automatically.

### 2. Watch Browser Console

Open your app at `http://localhost:3000` and check console:

```
P2PContext: Initializing server-side node...
[P2P API] Triggering server-side node initialization...
[P2P API] ✓ Server-side node initialized
P2PContext: Server-side node ready
```

### 3. Check Server Logs

In your terminal where `npm run dev` is running, you should see:

```
[P2P Service] Initializing server-side libp2p node...
Node started, waiting for bootstrap connections...
Bootstrap status: 0 peer(s) connected (need 1)
Bootstrap status: 1 peer(s) connected (need 1)
✓ Bootstrap connections established
✓ Node is fully initialized and ready for DHT queries
[P2P Service] ✓ Server-side node initialized successfully
```

### 4. Verify Status After Init

After a few seconds, check status again:
```
http://localhost:3000/api/p2p/status
```

Should return:
```json
{
  "initialized": true,
  "ready": true,
  "peerId": "16Uiu2HAm...",
  "connectedPeers": 1,
  "addresses": [...]
}
```

## API Endpoints

### GET /api/p2p/status
- Returns current node status
- Triggers initialization if not started
- Non-blocking (returns current state immediately)

### POST /api/p2p/init
- Explicitly initializes the node
- Waits for initialization to complete
- Returns final status

### GET /api/p2p/envs?peerId=...
- Gets environments from a peer
- Ensures node is initialized first

### POST /api/p2p/command
- Sends command to a peer
- Ensures node is initialized first

## Initialization Flow

```
1. App loads
   ↓
2. P2PContext mounts
   ↓
3. Calls initializeNodeAPI()
   ↓
4. POST /api/p2p/init
   ↓
5. ensureNodeInitialized() in p2pNodeService
   ↓
6. initializeNode() in nodeService
   ↓
7. Creates libp2p instance
   ↓
8. Waits for bootstrap connections
   ↓
9. Returns success
   ↓
10. P2PContext sets isReady = true
```

## Troubleshooting

### Still showing `initialized: false`

**Check:**
1. Server logs for errors
2. Browser console for errors
3. Network tab for failed API calls

**Try:**
```bash
# Restart dev server
# Kill the process and run again
npm run dev
```

### "Failed to initialize node"

**Possible causes:**
- Bootstrap nodes unreachable
- Network issues
- Port conflicts

**Check server logs for specific error**

### Initialization takes too long

**Normal behavior:**
- First init: 5-10 seconds (bootstrap connections)
- Subsequent requests: <100ms (warm instance)

**If longer:**
- Check network connectivity
- Verify bootstrap nodes are online
- Check firewall settings

## Files Changed

1. ✅ `src/services/p2pNodeService.ts` - NEW shared service
2. ✅ `src/pages/api/p2p/init.ts` - NEW init endpoint
3. ✅ `src/pages/api/p2p/status.ts` - Auto-triggers init
4. ✅ `src/pages/api/p2p/command.ts` - Uses shared service
5. ✅ `src/pages/api/p2p/envs.ts` - Uses shared service
6. ✅ `src/services/p2pApiService.ts` - Added initializeNodeAPI
7. ✅ `src/contexts/P2PContext.api.tsx` - Calls init on startup

## Next Steps

1. ✅ Refresh your browser
2. ✅ Check browser console
3. ✅ Check server logs
4. ✅ Navigate to node details page
5. ✅ Verify environments load

The node should now initialize automatically when the app loads!
