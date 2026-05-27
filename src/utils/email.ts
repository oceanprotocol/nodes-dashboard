import { readFileSync } from 'fs';
import { join } from 'path';

const blacklistedEmailProviders = new Set<string>(
  readFileSync(join(process.cwd(), 'public', 'disposable-email-blacklist.conf'), 'utf-8')
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
);

/**
 * Checks if the email's domain or any parent domain is blacklisted.
 * @param email - The email address to check against the blocklist.
 * @returns - True if the email is not blacklisted, false if it is blacklisted.
 */
export function isBlacklistedEmail(email: string) {
  const domainParts = email.split('@')[1].split('.');
  for (let i = 0; i < domainParts.length - 1; i++) {
    if (blacklistedEmailProviders.has(domainParts.slice(i).join('.'))) {
      return false;
    }
  }
  return true;
}

/**
 * Email providers that ignore dots in the local part
 */
const DOT_PROVIDERS = ['gmail.com', 'googlemail.com'];

/**
 * Normalizes an email address by lowercasing, removing dots for certain providers, and stripping tags.
 * @param email - The email address to normalize.
 * @returns - The normalized email address.
 */
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
