export type GrantHandleService = 'discord' | 'telegram';

export type GrantDetails = {
  email: string;
  goal: string;
  handle: string;
  handleService: GrantHandleService;
  hardware: string[];
  name: string;
  os: string;
  role: string;
  walletAddress: string;
};

export type GrantWithStatus = Omit<GrantDetails, 'handleService'> & {
  amount?: string;
  /** Legacy rows predate the Discord/Telegram split, so their service is unknown. */
  handleService?: GrantHandleService;
  /** Value of the original, service-agnostic handle column. Preserved on update, never written for new rows. */
  legacyHandle?: string;
  applicationDate: Date;
  claimDate?: Date;
  nonce?: number;
  otp?: string;
  otpAttempts?: number;
  otpExpires?: number;
  otpLastResent?: number;
  rawAmount?: string;
  signedFaucetMessage?: string;
  status: GrantStatus;
  txHash?: string;
};

export enum GrantStatus {
  PENDING = 'pending',
  EMAIL_VERIFIED = 'email-verified',
  SIGNED_FAUCET_MESSAGE = 'signed-faucet-message',
  CLAIMED = 'claimed',
}

export type SubmitGrantDetailsResponse = {
  shouldValidateEmail: boolean;
};

export type ClaimGrantResponse = {
  faucetAddress: string;
  nonce: number;
  rawAmount: string;
  signature: string;
  walletAddress: string;
};

export const GRANT_HANDLE_SERVICE_CHOICES: Array<{ label: string; value: GrantHandleService }> = [
  { label: 'Discord', value: 'discord' },
  { label: 'Telegram', value: 'telegram' },
];

/**
 * Per-service handle rules.
 * Discord: 2-32 chars, letters/digits/dot/underscore. The legacy "#1234" discriminator is rejected —
 * Discord retired it, current usernames cannot contain "#", and accepting both forms would let the
 * same person pass the uniqueness check twice.
 * Telegram: 5-32 chars, letters/digits/underscore.
 * Handles are stored without the leading "@" (see normalizeHandle).
 */
export const GRANT_HANDLE_RULES: Record<GrantHandleService, { message: string; regex: RegExp }> = {
  discord: {
    message: 'Enter a valid Discord handle (2-32 characters: letters, digits, "." or "_")',
    regex: /^[a-zA-Z0-9._]{2,32}$/,
  },
  telegram: {
    message: 'Enter a valid Telegram handle (5-32 characters: letters, digits or "_")',
    regex: /^[a-zA-Z0-9_]{5,32}$/,
  },
};

/**
 * Only whitespace and a leading "@" are forgiven. A pasted profile URL is left intact on purpose,
 * so it fails validation and the user retypes the bare handle rather than us guessing at the link.
 */
export function normalizeHandle(handle: string): string {
  if (typeof handle !== 'string') {
    return '';
  }
  // Handles never contain whitespace, so stripping it fixes paste artifacts instead of failing validation.
  return handle.replace(/\s+/g, '').replace(/^@+/, '');
}

/** Key used to decide whether two handles are the same account. Both platforms are case-insensitive. */
export function getHandleComparisonKey(handle: string): string {
  return normalizeHandle(handle).toLowerCase();
}

export function isValidHandle(handle: string, service: GrantHandleService): boolean {
  const rule = GRANT_HANDLE_RULES[service];
  if (!rule) {
    return false;
  }
  return rule.regex.test(normalizeHandle(handle));
}

export const GRANT_ROLE_CHOICES = [
  { label: 'AI developer', value: 'ai_dev' },
  { label: 'Data scientist', value: 'data_scientist' },
  { label: 'Student/ Researcher', value: 'student_or_researcher' },
  { label: 'Node operator/ Miner', value: 'node_operator_or_miner' },
  { label: 'Web3 builder/ Founder', value: 'web3_builder_or_founder' },
  { label: 'Crypto investor/ Trader', value: 'crypto_investor_or_trader' },
];

export const GRANT_HARDWARE_CHOICES = [
  { label: 'Ultra high-end gaming PC (NVIDIA GPU 4090/5090)', value: 'highend_gaming_pc' },
  { label: 'Lightweight gaming PC', value: 'light_gaming_pc' },
  { label: 'Apple (Mac M1 - M5)', value: 'apple' },
  { label: 'Enterprise/ Data center GPU (eg. H100/ A100)', value: 'data_center_gpu' },
  { label: 'Standard laptop/ CPU only', value: 'laptop_cpu_only' },
  { label: 'None/ Cloud resources only', value: 'none_or_cloud' },
];

export const GRANT_OS_CHOICES = [
  { label: 'Windows', value: 'windows' },
  { label: 'MacOS', value: 'macos' },
  { label: 'Linux', value: 'linux' },
];

export const GRANT_GOAL_CHOICES = [
  {
    description: 'I need affordable compute to train or fine-tune my own models',
    label: 'Train AI models',
    value: 'train_ai_models',
  },
  {
    description: 'I want to run autonomous bots for trading, predictions, or automation',
    label: 'Deploy AI agents',
    value: 'deploy_ai_agents',
  },
  {
    description: 'I am a developer building an App that would benefit from an out-of-the-box decentralized AI backend',
    label: 'Build an application',
    value: 'build_an_app',
  },
  {
    description: 'I am conducting research and need privacy-preserving infrastructure',
    label: 'Academic/ Private research',
    value: 'research',
  },
  {
    description: 'I want to earn revenue by renting out my GPU/CPU power',
    label: 'Monetize idle hardware',
    value: 'monetize_idle_hardware',
  },
];
