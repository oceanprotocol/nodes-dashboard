"use client"

import DocsCtaSection from '@/components/homepage/docs-cta-section';
import { OceanProvider } from '@/lib/OceanProvider';
import { useAppKit, useAppKitAccount, useAppKitProvider, type Provider } from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import { useEffect, useMemo } from 'react';
import FeaturesSection from './features';
import HeroSection from './hero-section';
import styles from './homepage.module.css';
import HowItWorksSection from './how-it-works';
import LeaderboardSection from './leaderboard';

const BASE_CHAIN_ID = 8453;
const ETH_SEPOLIA_CHAIN_ID = 11155111;

export default function HomePage() {
  const { open } = useAppKit();
  const account = useAppKitAccount();
  const chainId = process.env.NODE_ENV === 'production' ? BASE_CHAIN_ID : ETH_SEPOLIA_CHAIN_ID;
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
