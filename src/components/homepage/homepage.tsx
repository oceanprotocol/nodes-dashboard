import DocsCtaSection from '@/components/homepage/docs-cta-section';
import StatsSection from '@/components/homepage/stats-section';
import HeroSection from './hero-section';
import styles from './homepage.module.css';
import HowItWorksSection from './how-it-works';
import LeaderboardSection from './leaderboard';
import McpSection from './mcp-section';

export default function HomePage() {
  return (
    <div className={styles.root}>
      <HeroSection />
      <HowItWorksSection />
      <McpSection />
      {/* <FeaturesSection /> */}
      <StatsSection />
      <LeaderboardSection />
      <DocsCtaSection />
    </div>
  );
}
