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

const BEARER = 'API: `Authorization: Bearer <password>`';

// How each kind of service takes the password. Looked up by the raw engine, else the template id, else its `service`.
const SIGN_IN_HELP: Record<string, string> = {
  vllm: `API key (\`api_key\` in OpenAI clients). ${BEARER}`,
  llamacpp: `Web UI: enter it as the API key in Settings. ${BEARER}`,
  comfyui: `Browser: leave the username empty. ${BEARER}`,
  opencode: 'Username: `opencode`. API: `curl -u opencode:<password>`',
  'coding-agent-deepseek-v4-flash': 'Username: `dsh`',
  openclaw: 'Paste it as the token in the Control UI on your first visit',
  hermes: 'Username: the dashboard username you set',
  'open-webui': 'Email: `owner@ocean.local`',
};

export const serviceSignInHelp = (...keys: (string | undefined)[]): string =>
  keys.map((key) => key && SIGN_IN_HELP[key]).find(Boolean) ?? 'Use it to sign in';
