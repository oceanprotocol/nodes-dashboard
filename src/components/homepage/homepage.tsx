import FeaturesSection from './features';
import DocsCtaSection from './docs-cta-section';
import HeroSection from './hero-section';
import styles from './homepage.module.css';
import HowItWorksSection from './how-it-works';
import LeaderboardSection from './leaderboard';
import FooterSection from './footer-section';

export default function HomePage() {
  return (
    <div className={styles.root}>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <LeaderboardSection />
      <DocsCtaSection />
      <FooterSection />
    </div>
  );
}
