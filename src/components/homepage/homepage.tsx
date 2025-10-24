import DocsCtaSection from '@/components/homepage/docs-cta-section';
import { OceanProvider } from '@/lib/OceanProvider';
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetworkCore,
  useAppKitProvider,
  type Provider,
} from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import { useEffect, useMemo } from 'react';
import FeaturesSection from './features';
import HeroSection from './hero-section';
import styles from './homepage.module.css';
import HowItWorksSection from './how-it-works';
import LeaderboardSection from './leaderboard';

export default function HomePage() {
  const { open } = useAppKit();
  const account = useAppKitAccount();
  const { chainId } = useAppKitNetworkCore();
  const { walletProvider } = useAppKitProvider<Provider>('eip155');

  const provider = useMemo(() => {
    if (!walletProvider || !chainId) return null;
    return new BrowserProvider(walletProvider, chainId);
  }, [walletProvider, chainId]);

  const ocean = useMemo(() => {
    if (!provider || !chainId) return null;
    return new OceanProvider(Number(chainId), provider);
  }, [provider, chainId]);

  useEffect(() => {
    if (ocean) {
      ocean.getNodeBalance('https://compute1.oceanprotocol.com/').then((res) => console.log(res));
    }
  }, [ocean]);

  return (
    <div className={styles.root}>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <LeaderboardSection />
      <DocsCtaSection />
    </div>
  );
}
