import { EnvironmentAccess } from '@/types/environments';

export function checkEnvAccess(
  access: EnvironmentAccess | undefined,
  walletAddress: string | undefined
): boolean | null {
  if (!walletAddress) return null;
  if (!access?.addresses) return true;
  if (access.addresses.length === 0) return true;
  if (access.addresses.some((a) => a === '*')) return true;

  const lower = walletAddress.toLowerCase();
  return access.addresses.some((a) => a.toLowerCase() === lower);
}
