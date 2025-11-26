import DocsCtaSection from '@/components/homepage/docs-cta-section';
import { useOceanContext } from '@/context/ocean-context';
import { useEffect } from 'react';
import FeaturesSection from './features';
import HeroSection from './hero-section';
import styles from './homepage.module.css';
import HowItWorksSection from './how-it-works';
import LeaderboardSection from './leaderboard';

export default function HomePage() {
  // const chainId = process.env.NODE_ENV === 'production' ? BASE_CHAIN_ID : ETH_SEPOLIA_CHAIN_ID;
  // const { walletProvider } = useAppKitProvider<Provider>('eip155');
  // const account = useAppKitAccount();

  const { getNodeBalance } = useOceanContext();

  useEffect(() => {
    // if (ocean) {
    getNodeBalance('https://compute1.oceanprotocol.com/').then((res) => console.log(res));

    /* Code snippet below demonstrates basic signature usage for requests that
     * need user authorization.
     */
    //if (provider && account?.address) {
    //  const signer = new JsonRpcSigner(provider, account.address);
    //  const nodeUrl = 'http://localhost:8001'
    //  const expiryTimestamp = new Date(new Date().getTime() + 60 * 60 * 1000).getTime();
    //  let signature;
    //  signer?.signMessage(`${expiryTimestamp}`).then((res) => {
    //    signature = res;
    //    console.log({ signature });

    //    axios
    //      .post(`${nodeUrl}/logs`, { signature, expiryTimestamp: `${expiryTimestamp}` }, {})
    //      .then((res) => console.log('logs response: ', res));
    //  });
    //}
    // }
  }, [getNodeBalance]);

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
