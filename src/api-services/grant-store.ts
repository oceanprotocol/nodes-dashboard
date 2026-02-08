import { GrantDetails } from '@/types/grant';

type GrantStoreItem = {
  data: GrantDetails;
  otp: string;
  otpExpires: number;
};

export function initializeGrantStore() {
  (global as any).grantStore = (global as any).grantStore ?? new Map<string, GrantStoreItem>();
}

export function getGrantStore() {
  return (global as any).grantStore as Map<string, GrantStoreItem>;
}
