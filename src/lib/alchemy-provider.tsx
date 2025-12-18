import { config, queryClient } from '@/lib/config';
import { AlchemyAccountProvider } from '@account-kit/react';

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <AlchemyAccountProvider config={config} queryClient={queryClient}>
      {children}
    </AlchemyAccountProvider>
  );
}
