# Quick Start: Fix Mixed Content Issue in 5 Minutes

## The Problem
Your HTTPS app can't connect to `ws://` Ocean Protocol nodes.

## The Solution
Use Next.js API routes to run P2P on the server.

## Steps

### 1. Verify Files Exist

Check that these files were created:
- ✅ `src/pages/api/p2p/command.ts`
- ✅ `src/pages/api/p2p/envs.ts`
- ✅ `src/pages/api/p2p/status.ts`
- ✅ `src/services/p2pApiService.ts`
- ✅ `src/contexts/P2PContext.api.tsx`

### 2. Switch to API-Based Context

**Option A: Rename files (recommended)**
```bash
cd /Users/denisiuriet/Workspace/Ocean/nodes-dashboard

# Backup current context
mv src/contexts/P2PContext.tsx src/contexts/P2PContext.client.tsx

# Use API version
mv src/contexts/P2PContext.api.tsx src/contexts/P2PContext.tsx
```

**Option B: Update imports**
```typescript
// In your _app.tsx or wherever P2PProvider is used
// Change:
import { P2PProvider } from '@/contexts/P2PContext';
// To:
import { P2PProvider } from '@/contexts/P2PContext.api';
```

### 3. Test Locally

```bash
npm run dev
```

Open http://localhost:3000 and check browser console:
```
P2PContext: Waiting for server-side node to be ready...
Waiting for node... (0 peers connected)
Waiting for node... (1 peers connected)
✓ Server-side node is ready
```

### 4. Deploy

```bash
git add .
git commit -m "Use server-side P2P API to fix mixed content"
git push
```

Vercel will auto-deploy.

### 5. Verify Production

Open your production URL and check:
- ✅ No mixed content errors in console
- ✅ P2P operations work
- ✅ Can connect to Ocean nodes

## That's It! 🎉

Your app now works in production with HTTPS.

## How It Works

**Before:**
```
Browser (HTTPS) → ❌ ws://ocean-nodes (blocked)
```

**After:**
```
Browser (HTTPS) → Next.js API (HTTPS) → ws://ocean-nodes ✅
```

## Troubleshooting

### "Node not ready"
Wait a few seconds for server-side node to initialize.

### "API route not found"
Make sure files are in `src/pages/api/p2p/` directory.

### "Still getting mixed content error"
Make sure you switched to the API-based context.

## Component Usage

Your components don't need to change:

```typescript
function MyComponent() {
  const { isReady, sendCommand, getEnvs } = useP2P();
  
  // Same API as before!
  const handleClick = async () => {
    const result = await getEnvs(peerId);
  };
}
```

## Next Steps

- ✅ Read `NEXTJS_SERVER_SIDE_P2P.md` for details
- ✅ Monitor Vercel logs for any issues
- ✅ Enjoy working P2P in production!

---

**Questions?** Check `SOLUTION_COMPARISON.md` for alternatives.
