export type GrantHandleService = 'discord' | 'telegram';

export type GrantDetails = {
  email: string;
  handle: string;
  handleService: GrantHandleService;
  name: string;
  walletAddress: string;
};

export type GrantWithStatus = GrantDetails & {
  applicationDate: Date;
  claimDate?: Date;
  otp?: string;
  otpAttempts?: number;
  otpExpires?: number;
  otpLastResent?: number;
  status: GrantStatus;
  verifiedDate?: Date;
};

export enum GrantStatus {
  PENDING = 'pending',
  EMAIL_VERIFIED = 'email-verified',
  CLAIMED = 'claimed',
}

export type SubmitGrantDetailsResponse = {
  /** A verified row whose email was replaced, so the new address needs a code. */
  emailChanged?: boolean;
  shouldValidateEmail: boolean;
};

export type GrantStatusResponse = {
  applicationDate?: string;
  claimDate?: string;
  /** Hint like `al***@example.com`, since the endpoint is not authenticated. */
  maskedEmail?: string;
  otpExpires?: number;
  otpLastResent?: number;
  otpLocked?: boolean;
  status: GrantStatus | null;
  verifiedDate?: string;
};

export enum GrantVerifyError {
  EXPIRED = 'expired',
  INVALID_CODE = 'invalid-code',
  LOCKED = 'locked',
}

export type GrantVerifyErrorResponse = {
  attemptsLeft?: number;
  error?: GrantVerifyError;
  message: string;
};

export const GRANT_MAX_OTP_ATTEMPTS = 5;
export const GRANT_OTP_RESEND_COOLDOWN_SECONDS = 60;

export const GRANT_HANDLE_SERVICE_CHOICES: Array<{ label: string; value: GrantHandleService }> = [
  { label: 'Discord', value: 'discord' },
  { label: 'Telegram', value: 'telegram' },
];

/**
 * Per-service handle rules.
 * Discord: 2-32 chars, letters/digits/dot/underscore, no consecutive dots (Discord forbids them).
 * The legacy "#1234" discriminator is rejected —
 * Discord retired it, current usernames cannot contain "#", and accepting both forms would let the
 * same person pass the uniqueness check twice.
 * Telegram: 5-32 chars, letters/digits/underscore.
 * Handles are stored without the leading "@" (see normalizeHandle).
 */
export const GRANT_HANDLE_RULES: Record<GrantHandleService, { message: string; regex: RegExp }> = {
  discord: {
    message: 'Enter a valid Discord handle (2-32 characters: letters, digits, "." or "_", no consecutive dots)',
    regex: /^(?!.*\.\.)[a-zA-Z0-9._]{2,32}$/,
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
