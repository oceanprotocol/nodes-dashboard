import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { renderSimpleMarkdown } from '@/utils/simple-markdown';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import styles from './outage-banner.module.css';

const isEnabled = process.env.NEXT_PUBLIC_OUTAGE_BANNER_ENABLED === 'true';
const message = process.env.NEXT_PUBLIC_OUTAGE_BANNER_MESSAGE?.trim();

const OutageBanner: React.FC = () => {
  if (!isEnabled || !message) {
    return null;
  }

  return (
    <Container>
      <Card
        className={styles.root}
        direction="column"
        padding="sm"
        radius="md"
        role="alert"
        shadow="warning"
        variant="warning"
      >
        <div className={styles.row}>
          <WarningAmberOutlinedIcon className={styles.icon} />
          <div className={styles.message}>{renderSimpleMarkdown(message)}</div>
        </div>
      </Card>
    </Container>
  );
};

export default OutageBanner;
