import { createHash, randomInt, timingSafeEqual } from 'crypto';

export function generateOTP() {
  const otp = randomInt(100000, 1000000).toString();
  const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return { otp, otpExpires };
}

export function hashOTP(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function verifyOTP(plaintext: string, hash: string): boolean {
  if (!hash) return false;
  const expected = Buffer.from(hashOTP(plaintext), 'hex');
  const actual = Buffer.from(hash, 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
