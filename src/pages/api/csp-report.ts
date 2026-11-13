import type { NextApiRequest, NextApiResponse } from 'next';

// Browsers POST Content-Security-Policy violation reports here (the `report-uri` in src/proxy.ts).
// A report is a few hundred bytes; 16kb bounds what anyone can make this route buffer.
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

// Longest any one field gets in the log line, so a report cannot flood it.
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

/**
 * Logs one line per violation so the Report-Only period can be read from the deployment logs:
 * which directive, what it blocked, on which page. Nothing is stored and nothing is answered
 * beyond the status, so there is nothing here for a client to extract.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Browsers send `application/csp-report`, which Next's body parser leaves as a string; a JSON
  // content type arrives already parsed.
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
    `[csp-report] ${field(r['effective-directive'] ?? r['violated-directive'])} blocked ${field(r['blocked-uri'])} on ${field(r['document-uri'])} (${field(r['source-file'])}:${field(r['line-number'])})`
  );
  return res.status(204).end();
}
