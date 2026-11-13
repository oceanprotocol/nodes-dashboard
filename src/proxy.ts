import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request Content Security Policy with a script nonce (Next 16 runs this file as the proxy, the
 * renamed middleware).
 *
 * `CSP_MODE` picks the response header: `report-only` (the default) sends
 * `Content-Security-Policy-Report-Only`, so violations reach /api/csp-report without blocking
 * anything; `enforce` sends `Content-Security-Policy`; `off` sends neither. Flip to `enforce` only
 * after a clean Report-Only period.
 *
 * The nonce travels on two request headers: Next's Pages renderer reads it from
 * `content-security-policy` to stamp its own scripts, and `x-nonce` is for _document/_app, which
 * stamp the scripts they render themselves.
 *
 * The headers that need no nonce (frame-ancestors, nosniff, HSTS, …) are set for every response in
 * next.config.mjs. A header set here replaces a same-named one from there, so the enforced policy
 * repeats the static CSP directives rather than relying on both headers being present.
 */

const IS_DEV = process.env.NODE_ENV === 'development';

// What the app embeds in an <iframe>. Script hosts are deliberately absent: 'strict-dynamic'
// extends trust from the nonced scripts to whatever they load (Cookiebot's unblocked tags, gtag,
// PostHog's recorder, Turnstile's api.js), and `connect-src https:` has to stay open because nodes
// are arbitrary operator hosts.
const FRAME_SRC = [
  // BotID's challenge is served from this origin (a rewrite in next.config.mjs).
  "'self'",
  // Privy embedded-wallet iframe.
  'https://auth.privy.io',
  // Cloudflare Turnstile, loaded by Privy's login modal.
  'https://challenges.cloudflare.com',
  // Alchemy signer (Turnkey) iframes, mounted by @privy-io/alchemy-migration for migrated accounts.
  'https://auth.turnkey.com',
  'https://export.turnkey.com',
  // WalletConnect Verify, bundled through @account-kit/react.
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
  // Cookiebot consent sharing.
  'https://consentcdn.cookiebot.com',
  // Ramp top-up widget: the SDK's default host, and the demo host used outside production.
  'https://app.rampnetwork.com',
  'https://app.demo.rampnetwork.com',
  // GitBook docs assistant: `${siteURL}~gitbook/embed`.
  'https://docs.oncompute.ai',
  // Google Ads conversion tag (gtag) iframes.
  'https://td.doubleclick.net',
];

function buildPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' only in dev, for source maps and React Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ''}`,
    // MUI/Emotion inject style tags and components use inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: data:",
    // Nodes are arbitrary operator hosts, so this cannot be a host list. Dev also talks plain http/ws.
    `connect-src 'self' https: wss:${IS_DEV ? ' http: ws:' : ''}`,
    `frame-src ${FRAME_SRC.join(' ')}`,
    "worker-src 'self' blob:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    'report-uri /api/csp-report',
  ].join('; ');
}

function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}

export function proxy(request: NextRequest) {
  const mode = process.env.CSP_MODE ?? 'report-only';
  if (mode === 'off') {
    return NextResponse.next();
  }

  const nonce = makeNonce();
  const policy = buildPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', policy);
  return response;
}

export const config = {
  // Pages only. Skipped: API routes, Next's assets and data fetches, the service worker, BotID's
  // challenge/proxy paths (rewritten in next.config.mjs) and anything with a file extension.
  matcher: [
    '/((?!api/|_next/static|_next/image|_next/data|sw\\.js$|149e9513-01fa-4fb0-aad4-566afd725d1b/|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
