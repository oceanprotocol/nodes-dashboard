import type { NextApiRequest, NextApiResponse } from 'next'

// Docker Hub's hub.docker.com/v2 API returns no Access-Control-Allow-Origin header, so a browser
// fetch is blocked by CORS (the response arrives 200 but is unreadable). This route proxies the tag
// listing server-side (no CORS in server-to-server fetch) and hands the browser a same-origin JSON
// payload. Repo is validated to a `namespace/repo` shape and only ever appended to the fixed Docker
// Hub host, so this can't be turned into an open proxy.

const REPO_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/

type DockerHubTag = {
  name: string
  last_updated?: string
}

function getOriginHost(req: NextApiRequest): string | null {
  const origin = req.headers.origin ?? req.headers.referer
  if (!origin) return null
  try {
    return new URL(origin).hostname
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appHost = req.headers.host?.split(':')[0]
  const originHost = getOriginHost(req)
  // Same-origin only. Direct navigation (no Origin/Referer) is allowed so the route stays testable.
  if (originHost && originHost !== appHost) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const repo = typeof req.query.repo === 'string' ? req.query.repo : ''
  if (!REPO_RE.test(repo)) {
    return res.status(400).json({ error: 'Invalid repo' })
  }

  try {
    const upstreamUrl = new URL(`https://hub.docker.com/v2/repositories/${repo}/tags`)
    upstreamUrl.searchParams.set('page_size', '100')
    upstreamUrl.searchParams.set('ordering', 'last_updated')
    const upstream = await fetch(upstreamUrl, { cache: 'no-store' })
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Upstream error', status: upstream.status })
    }
    const data: { results?: DockerHubTag[] } = await upstream.json()
    const tags = (data.results ?? [])
      .filter((result) => result.name)
      .sort((a, b) => {
        const aUpdated = a.last_updated ? Date.parse(a.last_updated) : 0
        const bUpdated = b.last_updated ? Date.parse(b.last_updated) : 0
        return bUpdated - aUpdated
      })
      .map((result) => result.name)
      .filter((tag, index, allTags) => allTags.indexOf(tag) === index)
    // Cache at the edge: the tag list moves slowly and is identical for every viewer.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json({ tags })
  } catch (err) {
    console.error('[docker-tags proxy] upstream error:', err)
    return res.status(502).json({ error: 'Bad gateway' })
  }
}
