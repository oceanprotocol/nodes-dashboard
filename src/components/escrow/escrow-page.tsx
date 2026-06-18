import Container from '@/components/container/container';
import EscrowTokenPanel from '@/components/escrow/escrow-token-panel';
import SectionTitle from '@/components/section-title/section-title';
import { useEscrowData } from '@/lib/use-escrow-data';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import styles from './escrow-page.module.css';

const EscrowPage = () => {
  const { tokens, spenders, loading, reload } = useEscrowData();

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Escrow management"
        subTitle="Deposit and withdraw escrow funds, and manage the spending authorizations used to pay for compute jobs."
      />
      <div className={classNames('pageContentWrapper', styles.content)}>
        {loading && tokens.length === 0 ? (
          <CircularProgress className="alignSelfCenter" />
        ) : (
          <div className={styles.panels}>
            {tokens.map((token) => {
              const tokenSpenders = spenders.filter(
                (s) => s.tokenAddress.toLowerCase() === token.address.toLowerCase()
              );
              return (
                <EscrowTokenPanel
                  key={token.address}
                  loadingSpenders={loading}
                  onChange={reload}
                  spenders={tokenSpenders}
                  token={token}
                />
              );
            })}
          </div>
        )}
      </div>
    </Container>
  );
};

export default EscrowPage;
