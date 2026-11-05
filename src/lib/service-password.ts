export const SERVICE_PASSWORD_ENV = 'SERVICE_PASSWORD';

export const isValidServicePassword = (value: string) => /^\S{1,256}$/.test(value);

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

const BEARER = 'API: send `Authorization: Bearer <password>`.';

// How each kind of service takes the password. Looked up by the raw engine, else the template id, else its `service`.
const SIGN_IN_HELP: Record<string, string> = {
  vllm: 'Use it as the API key: `Authorization: Bearer <password>` (`api_key` in OpenAI clients).',
  llamacpp: `In the web UI, enter it as the API key in Settings. ${BEARER}`,
  comfyui: `When the browser asks you to sign in, leave the username empty and enter this password. ${BEARER}`,
  opencode: 'Sign in with the username `opencode` and this password. API: `curl -u opencode:<password>`.',
  'coding-agent-deepseek-v4-flash': 'Sign in with the username `dsh` and this password.',
  openclaw: 'On your first visit, paste this password as the token in the Control UI.',
  hermes: 'Sign in with the dashboard username you set and this password.',
  'open-webui': 'Sign in with the email `owner@ocean.local` and this password.',
};

export const serviceSignInHelp = (...keys: (string | undefined)[]): string =>
  keys.map((key) => key && SIGN_IN_HELP[key]).find(Boolean) ?? 'Use this password to sign in.';

// The password is kept in the browser that launched the service, next to the node login tokens.
// TODO(#240): Reveal on other devices needs an owner-only node command that returns the service's
// decrypted userData (it already holds SERVICE_PASSWORD / LLAMA_API_KEY); then drop this storage.
const STORAGE_PREFIX = 'inference-service-password';

export function rememberServicePassword(serviceId: string, password: string | undefined): void {
  if (!password) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}-${serviceId}`, password);
  } catch (error) {
    console.error('Failed to save the service password:', error);
  }
}

export function recallServicePassword(serviceId: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}-${serviceId}`);
  } catch {
    return null;
  }
}
