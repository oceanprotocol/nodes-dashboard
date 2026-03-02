import Card from '@/components/card/card';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import SwapTokens from '@/components/swap-tokens/swap-tokens';
import styles from './swap-tokens-page.module.css';

const SwapTokensPage: React.FC = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Get COMPY" subTitle="Convert your USDC to COMPY" />
      <div className="pageContentWrapper">
        <Card className={styles.root} direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
          <SwapTokens refetchOnSuccess />
        </Card>
      </div>
    </Container>
  );
};

export default SwapTokensPage;
