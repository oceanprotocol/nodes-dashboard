import type { NextApiRequest, NextApiResponse } from 'next';

// 16kb because a real report is a few hundred bytes and anyone can POST to this route.
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

// Reports are client-supplied, so each field is capped to keep one report from flooding the logs.
const MAX_FIELD = 200;

type CspReport = Partial<
  Record<
    'document-uri' | 'effective-directive' | 'violated-directive' | 'blocked-uri' | 'source-file' | 'line-number',
    unknown
  >
>;

function field(value: unknown): string {
  return (typeof value === 'string' || typeof value === 'number' ? String(value) : '-').slice(0, MAX_FIELD);
}

// Query strings and fragments are dropped because OAuth redirects carry codes and state there, and these
// lines end up in the deployment logs. Values that aren't URLs (`inline`, `eval`) fall through unchanged.
function urlField(value: unknown): string {
  if (typeof value !== 'string') {
    return field(value);
  }
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return field(url.toString());
  } catch {
    return field(value.split(/[?#]/)[0]);
  }
}

/**
 * Exists so the Report-Only rollout of the policy in src/proxy.ts can be reviewed from the deployment
 * logs before CSP_MODE is switched to `enforce`.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Parsed by hand because Next's body parser doesn't recognise `application/csp-report`, the type
  // browsers send, and leaves the body as a string.
  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).end();
    }
  }
  const report = (body as { 'csp-report'?: unknown } | null)?.['csp-report'];
  if (typeof report !== 'object' || report === null) {
    return res.status(400).end();
  }

  const r = report as CspReport;
  console.warn(
    `[csp-report] ${field(r['effective-directive'] ?? r['violated-directive'])} blocked ${urlField(r['blocked-uri'])} on ${urlField(r['document-uri'])} (${urlField(r['source-file'])}:${field(r['line-number'])})`
  );
  return res.status(204).end();
}
