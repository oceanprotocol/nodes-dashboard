import { getBytes, Signature } from 'ethers';

export const SERVICE_PASSWORD_ENV = 'SERVICE_PASSWORD';

export const isValidServicePassword = (value: string) => /^\S{1,256}$/.test(value);

export const BLOB_PREFIX = 'v1.';
const IV_BYTES = 12;
const PASSWORD_LENGTH = 24;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// Bytes at or above this are discarded to avoid modulo bias.
const MAX_UNBIASED_BYTE = 256 - (256 % ALPHABET.length);

export function generateServicePassword(): string {
  let password = '';
  while (password.length < PASSWORD_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH))) {
      if (byte < MAX_UNBIASED_BYTE && password.length < PASSWORD_LENGTH) {
        password += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return password;
}

/**
 * The text the wallet signs to unlock stored passwords. Frozen: changing a single character changes
 * the signature, and with it the key, so every stored password would stop decrypting. `host` is part
 * of the text so a signature given to another site cannot be replayed here.
 */
export function passwordKeyMessage(host: string, address: string): string {
  return `${host} wants you to sign in with your Ethereum account:\n${address}\n\nUnlock your Ocean service passwords. Only sign this on ${host}.`;
}

// Fixes the v byte (27/28 vs 0/1); signatures that are not plain ECDSA stay raw.
function normalizeSignature(signature: string): string {
  try {
    return Signature.from(signature).serialized;
  } catch {
    return signature;
  }
}

// AES-GCM key = SHA-256 of the normalised signature. Not extractable.
export async function derivePasswordKey(signature: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(getBytes(normalizeSignature(signature))));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// `v1.<base64url iv>.<base64url ciphertext>`
export async function encryptServicePassword(key: CryptoKey, password: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new Uint8Array(new TextEncoder().encode(password))
  );
  return `${BLOB_PREFIX}${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

// Throws `cannot unlock` for a wrong key or a malformed blob.
export async function decryptServicePassword(key: CryptoKey, blob: string): Promise<string> {
  try {
    const parts = blob.split('.');
    if (parts.length !== 3 || `${parts[0]}.` !== BLOB_PREFIX) {
      throw new Error('bad blob');
    }
    const iv = fromBase64Url(parts[1]);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64Url(parts[2]));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('cannot unlock');
  }
}
