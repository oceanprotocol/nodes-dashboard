import { NextResponse, type NextRequest } from 'next/server';

/**
 * The policy is built here rather than in next.config.mjs because its nonce has to change on every
 * response.
 *
 * `CSP_MODE` defaults to `report-only` because the app loads many third-party SDKs and has no test
 * suite, so violations are collected at /api/csp-report before anything is blocked. `off` exists as
 * a quick way out if the policy breaks a flow in production.
 *
 * The nonce is set on two request headers because Next's Pages renderer only reads it out of
 * `content-security-policy`, while _document and _app need it as a plain value (`x-nonce`).
 *
 * The policy repeats the static directives from next.config.mjs because, in `enforce` mode, a header
 * set here replaces the same-named one from there.
 */

const IS_DEV = process.env.NODE_ENV === 'development';

// Frame hosts must be listed one by one, but script hosts need not be: 'strict-dynamic' lets the
// nonced scripts load their own dependencies, and browsers that support it ignore script host lists.
// Each entry names the feature that needs it, so an unused one can be removed when that feature goes.
const FRAME_SRC = [
  // BotID's challenge, which next.config.mjs rewrites onto this origin.
  "'self'",
  // Privy's embedded wallet.
  'https://auth.privy.io',
  // Cloudflare Turnstile, shown by Privy's login modal.
  'https://challenges.cloudflare.com',
  // Alchemy signer (Turnkey), mounted by @privy-io/alchemy-migration for migrated accounts.
  'https://auth.turnkey.com',
  'https://export.turnkey.com',
  // WalletConnect Verify, pulled in through @account-kit/react.
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
  // Cookiebot consent sharing.
  'https://consentcdn.cookiebot.com',
  // Ramp top-up: the SDK's default host, plus the demo host used outside production.
  'https://app.rampnetwork.com',
  'https://app.demo.rampnetwork.com',
  // GitBook docs assistant, which frames `${siteURL}~gitbook/embed`.
  'https://docs.oncompute.ai',
  // Google Ads conversion tag.
  'https://td.doubleclick.net',
];

function buildPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' only in dev, because source maps and React Refresh need it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ''}`,
    // 'unsafe-inline' because MUI/Emotion inject style tags and components set inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: data:",
    // Not a host list because nodes run on arbitrary operator hosts. Dev adds plain http/ws for local nodes.
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
  // Only HTML pages run scripts that need the nonce, so everything else is skipped to avoid running the
  // proxy on every asset. BotID's paths are skipped because it sets its own headers there.
  matcher: [
    '/((?!api/|_next/static|_next/image|_next/data|sw\\.js$|149e9513-01fa-4fb0-aad4-566afd725d1b/|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};
