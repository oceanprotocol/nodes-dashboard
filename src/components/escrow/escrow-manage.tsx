import EscrowTokenPanel from '@/components/escrow/escrow-token-panel';
import { useEscrowData } from '@/lib/use-escrow-data';
import { CircularProgress } from '@mui/material';
import styles from './escrow-manage.module.css';

const EscrowManage = () => {
  const { tokens, spenders, loading, reload } = useEscrowData();

  if (loading && tokens.length === 0) {
    return <CircularProgress className="alignSelfCenter" />;
  }

  return (
    <div className={styles.panels}>
      {tokens.map((token) => {
        const tokenSpenders = spenders.filter((s) => s.tokenAddress.toLowerCase() === token.address.toLowerCase());
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
  );
};

export default EscrowManage;
