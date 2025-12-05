# Vercel Deployment Guide: Server-Side P2P

## What Happens When You Deploy

When you push these changes to Vercel, here's what will happen:

### 1. **Build Process**
```
git push
  ↓
Vercel detects changes
  ↓
Builds Next.js app
  ↓
Creates serverless functions for API routes
  ↓
Deploys to edge network
  ↓
✅ Live at your-app.vercel.app
```

### 2. **API Routes Become Serverless Functions**

Each API route becomes a separate serverless function:
- `/api/p2p/init` → Serverless function
- `/api/p2p/status` → Serverless function
- `/api/p2p/command` → Serverless function
- `/api/p2p/envs` → Serverless function

## How Server-Side P2P Works on Vercel

### **Serverless Function Lifecycle**

```
Request comes in
  ↓
Function "cold starts" (if idle)
  ↓
Runs initialization code
  ↓
Creates libp2p node instance
  ↓
Connects to bootstrap nodes
  ↓
Processes request
  ↓
Returns response
  ↓
Function stays "warm" for ~5 minutes
  ↓
If no requests, function goes idle
```

### **Important Characteristics**

#### ✅ **What Works Well**
1. **First Request (Cold Start)**
   - Takes ~5-10 seconds
   - Initializes libp2p node
   - Connects to bootstrap nodes
   - Processes request

2. **Subsequent Requests (Warm)**
   - Takes <100ms
   - Reuses existing node instance
   - No re-initialization needed
   - Fast response

3. **Multiple Concurrent Requests**
   - Each function instance handles requests
   - Vercel auto-scales as needed
   - Shared initialization logic prevents duplicates

#### ⚠️ **Limitations to Be Aware Of**

1. **Function Timeout**
   - **Hobby Plan**: 10 seconds max
   - **Pro Plan**: 60 seconds max
   - If peer discovery takes longer, request will timeout

2. **Function Idle Timeout**
   - After ~5 minutes of no requests, function goes idle
   - Next request will be a cold start again
   - Node instance is lost

3. **No Persistent Connections**
   - Between requests, connections may be dropped
   - Each request may need to re-establish peer connections
   - DHT routing table is rebuilt on cold starts

4. **Memory Limits**
   - **Hobby**: 1GB RAM
   - **Pro**: 3GB RAM
   - libp2p uses ~128MB, should be fine

## What This Means for Your App

### **User Experience**

#### First Visit (Cold Start)
```
User opens node details page
  ↓
Browser calls /api/p2p/init
  ↓
⏱️ 5-10 seconds (initializing)
  ↓
✅ Node ready
  ↓
Environments load
```

#### Subsequent Visits (Warm Function)
```
User opens node details page
  ↓
Browser calls /api/p2p/envs
  ↓
⏱️ <1 second (already initialized)
  ↓
✅ Environments load
```

#### After 5+ Minutes Idle
```
Function goes cold
  ↓
Next user gets cold start again
  ↓
⏱️ 5-10 seconds
```

### **Recommended Optimizations**

#### 1. **Add Loading States**

Update your components to show loading indicators:

```typescript
const Environments = ({ node }: EnvironmentsProps) => {
  const { envs, isReady, getEnvs } = useP2P();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (node?.id && isReady) {
      setLoading(true);
      getEnvs(node.id)
        .finally(() => setLoading(false));
    }
  }, [node?.id, isReady, getEnvs]);

  if (loading) {
    return <div>Loading environments...</div>;
  }

  // ... rest of component
};
```

#### 2. **Increase Function Timeout (Pro Plan)**

If you have Vercel Pro, create `vercel.json`:

```json
{
  "functions": {
    "src/pages/api/p2p/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

#### 3. **Keep Functions Warm (Optional)**

Add a cron job to ping your API every 4 minutes:

```typescript
// src/pages/api/cron/keep-warm.ts
export default async function handler(req, res) {
  // Ping status endpoint to keep function warm
  await fetch(`${process.env.VERCEL_URL}/api/p2p/status`);
  res.status(200).json({ warmed: true });
}
```

Then configure in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/keep-warm",
    "schedule": "*/4 * * * *"
  }]
}
```

**Note**: Cron jobs require Vercel Pro plan.

#### 4. **Add Error Handling for Timeouts**

```typescript
// In your components
const getEnvs = async (peerId: string) => {
  try {
    await getNodeEnvsAPI(peerId);
  } catch (error) {
    if (error.message.includes('timeout')) {
      // Show user-friendly message
      console.log('Request timed out, please try again');
    }
  }
};
```

## Expected Behavior After Deployment

### **Scenario 1: Low Traffic**
- Most requests will be cold starts
- Users experience 5-10 second initial load
- Acceptable for admin/internal tools

### **Scenario 2: Moderate Traffic**
- Functions stay warm most of the time
- Fast responses (<1 second)
- Good user experience

### **Scenario 3: High Traffic**
- Vercel auto-scales functions
- Multiple instances running
- Each instance initializes independently
- Consistent performance

## Monitoring After Deployment

### **1. Check Vercel Logs**

```bash
vercel logs --follow
```

Look for:
```
[P2P Service] Initializing server-side libp2p node...
✓ Bootstrap connections established
[P2P API] ✓ Server-side node initialized
```

### **2. Monitor Function Duration**

In Vercel Dashboard:
- Go to your project
- Click "Functions"
- Check execution time
- Watch for timeouts

### **3. Check Error Rate**

Look for:
- Timeout errors (10s limit hit)
- Initialization failures
- Bootstrap connection failures

## Troubleshooting Production Issues

### **"Function timeout" errors**

**Cause**: Initialization taking >10 seconds

**Solutions**:
1. Upgrade to Pro plan (60s timeout)
2. Reduce bootstrap timeout in code
3. Use fewer bootstrap nodes

### **"Node not ready" errors**

**Cause**: Cold start in progress

**Solutions**:
1. Add better loading states
2. Implement retry logic
3. Keep functions warm with cron

### **High cold start frequency**

**Cause**: Low traffic, functions going idle

**Solutions**:
1. Accept it (if acceptable UX)
2. Implement keep-warm cron (Pro plan)
3. Consider dedicated server for high-traffic apps

## Alternative: Dedicated Server

If serverless limitations are too restrictive, consider:

### **Option A: Vercel + Separate P2P Server**
- Deploy Next.js app to Vercel (frontend)
- Deploy P2P node to Railway/Render (backend)
- Update API routes to proxy to dedicated server

### **Option B: Full Dedicated Hosting**
- Deploy entire app to Railway/Render
- Persistent P2P node
- No cold starts
- Higher cost

## Recommendation for Your Use Case

### **Start with Serverless (Current Approach)**

✅ **Pros**:
- Zero infrastructure management
- Auto-scaling
- Cost-effective for low/medium traffic
- Easy deployment

⚠️ **Cons**:
- Cold starts (5-10s)
- Function timeouts possible
- No persistent connections

### **When to Switch to Dedicated Server**

Consider switching if:
- Cold starts are unacceptable
- High traffic (functions always warm anyway)
- Need persistent P2P connections
- Timeout issues persist

## Deployment Checklist

Before pushing to production:

- [ ] Test locally (`npm run dev`)
- [ ] Verify initialization works
- [ ] Add loading states to components
- [ ] Test with slow network
- [ ] Add error handling for timeouts
- [ ] Monitor Vercel logs after deploy
- [ ] Check function execution times
- [ ] Verify bootstrap connections work in production

## Summary

**What will happen:**
1. ✅ Code will deploy successfully
2. ✅ API routes become serverless functions
3. ✅ First request: 5-10 second cold start
4. ✅ Subsequent requests: <1 second (warm)
5. ⚠️ After 5 min idle: cold start again

**Is this acceptable?**
- ✅ Yes for internal tools / low traffic
- ✅ Yes for moderate traffic (functions stay warm)
- ⚠️ Maybe for high-traffic public apps (consider dedicated server)

**Next steps:**
1. Push to Vercel
2. Monitor initial deployment
3. Check logs for errors
4. Test user experience
5. Optimize based on actual usage patterns

The serverless approach will work fine for most use cases. You can always migrate to a dedicated server later if needed!
