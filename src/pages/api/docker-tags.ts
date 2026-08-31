import type { NextApiRequest, NextApiResponse } from 'next'

// Docker Hub's hub.docker.com/v2 API returns no Access-Control-Allow-Origin header, so a browser
// fetch is blocked by CORS (the response arrives 200 but is unreadable). This route proxies the tag
// listing server-side (no CORS in server-to-server fetch) and hands the browser a same-origin JSON
// payload. Repo is validated to a `namespace/repo` shape and only ever appended to the fixed Docker
// Hub host, so this can't be turned into an open proxy.

const REPO_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const MAX_TAG_LIMIT = 100

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const repo = typeof req.query.repo === 'string' ? req.query.repo : ''
  if (!REPO_RE.test(repo)) {
    return res.status(400).json({ error: 'Invalid repo' })
  }
  const requestedLimit = req.query.limit == null ? MAX_TAG_LIMIT : Number(req.query.limit)
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_TAG_LIMIT) {
    return res.status(400).json({ error: 'Invalid limit' })
  }

  try {
    const upstreamUrl = new URL(`https://hub.docker.com/v2/repositories/${repo}/tags`)
    upstreamUrl.searchParams.set('page_size', String(requestedLimit))
    upstreamUrl.searchParams.set('ordering', 'last_updated')
    const upstream = await fetch(upstreamUrl, { cache: 'no-store' })
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Upstream error', status: upstream.status })
    }
    const data: { results?: { name?: string }[] } = await upstream.json()
    const tags = (data.results ?? []).flatMap((result) => (result.name ? [result.name] : []))
    // Cache at the edge: the tag list moves slowly and is identical for every viewer.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json({ tags })
  } catch (err) {
    console.error('[docker-tags proxy] upstream error:', err)
    return res.status(502).json({ error: 'Bad gateway' })
  }
}
