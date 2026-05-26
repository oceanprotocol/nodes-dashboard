/**
 * Email providers that ignore dots in the local part
 */
const DOT_PROVIDERS = ['gmail.com', 'googlemail.com'];

export function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().split('@');
  const localNoPlus = localPart.split('+')[0];
  // Convert IDN/Unicode domain to ASCII to defeat homograph-based blacklist bypass
  let asciiDomain = domain;
  try {
    asciiDomain = new URL(`http://${domain}`).hostname;
  } catch {
    // Fall back to original (already lower-cased) domain on parse failure
  }
  const normalizedLocal = DOT_PROVIDERS.includes(asciiDomain) ? localNoPlus.replace(/\./g, '') : localNoPlus;
  return `${normalizedLocal}@${asciiDomain}`;
}
