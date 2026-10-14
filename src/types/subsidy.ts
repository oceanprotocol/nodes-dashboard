export type SubsidyHandleService = 'discord' | 'telegram';

export type SubsidyDetails = {
  email: string;
  handle: string;
  handleService: SubsidyHandleService;
  name: string;
  walletAddress: string;
};

export type SubsidyWithStatus = SubsidyDetails & {
  applicationDate: Date;
  claimDate?: Date;
  otp?: string;
  otpAttempts?: number;
  otpExpires?: number;
  otpLastResent?: number;
  status: SubsidyStatus;
  verifiedDate?: Date;
};

export enum SubsidyStatus {
  PENDING = 'pending',
  EMAIL_VERIFIED = 'email-verified',
  CLAIMED = 'claimed',
}

export type SubmitSubsidyDetailsResponse = {
  emailChanged?: boolean;
  shouldValidateEmail: boolean;
};

export type SubsidyStatusResponse = {
  applicationDate?: string;
  claimDate?: string;
  /** Masked: the endpoint is unauthenticated. */
  maskedEmail?: string;
  otpExpires?: number;
  otpLastResent?: number;
  otpLocked?: boolean;
  status: SubsidyStatus | null;
  verifiedDate?: string;
};

export enum SubsidyVerifyError {
  EXPIRED = 'expired',
  INVALID_CODE = 'invalid-code',
  LOCKED = 'locked',
}

export type SubsidyVerifyErrorResponse = {
  attemptsLeft?: number;
  error?: SubsidyVerifyError;
  message: string;
};

export const SUBSIDY_MAX_OTP_ATTEMPTS = 5;
export const SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS = 60;

export const SUBSIDY_HANDLE_SERVICE_CHOICES: Array<{ label: string; value: SubsidyHandleService }> = [
  { label: 'Discord', value: 'discord' },
  { label: 'Telegram', value: 'telegram' },
];

/** Discord's legacy "#1234" form is rejected so one person can't pass the uniqueness check twice. */
export const SUBSIDY_HANDLE_RULES: Record<SubsidyHandleService, { message: string; regex: RegExp }> = {
  discord: {
    message: 'Enter a valid Discord handle (2-32 characters: letters, digits, "." or "_", no consecutive dots)',
    regex: /^(?!.*\.\.)[a-zA-Z0-9._]{2,32}$/,
  },
  telegram: {
    message: 'Enter a valid Telegram handle (5-32 characters: letters, digits or "_")',
    regex: /^[a-zA-Z0-9_]{5,32}$/,
  },
};

/** Profile URLs are left intact so they fail validation. */
export function normalizeHandle(handle: string): string {
  if (typeof handle !== 'string') {
    return '';
  }
  return handle.replace(/\s+/g, '').replace(/^@+/, '');
}

/** Both platforms are case-insensitive. */
export function getHandleComparisonKey(handle: string): string {
  return normalizeHandle(handle).toLowerCase();
}

export function isValidHandle(handle: string, service: SubsidyHandleService): boolean {
  const rule = SUBSIDY_HANDLE_RULES[service];
  if (!rule) {
    return false;
  }
  return rule.regex.test(normalizeHandle(handle));
}
