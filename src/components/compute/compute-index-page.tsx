import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import inferenceStyles from '@/components/inference/inference-index-page.module.css';
import SectionTitle from '@/components/section-title/section-title';
import { getRoutes } from '@/config';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';
import classNames from 'classnames';
import styles from './compute-index-page.module.css';

const ComputeIndexPage: React.FC = () => {
  const routes = getRoutes();

  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Compute" subTitle="Run compute jobs on Ocean Nodes, or provide your own" />
      <div className="pageContentWrapper">
        <div className={classNames(inferenceStyles.cards, styles.cards)}>
          <Card
            className={classNames(inferenceStyles.card, inferenceStyles.cardHighlighted)}
            direction="column"
            padding="md"
            radius="lg"
            shadow="accent1"
            spacing="md"
            variant="glass-shaded"
          >
            <div className={inferenceStyles.iconBox}>
              <TerminalOutlinedIcon />
            </div>
            <div className={inferenceStyles.cardContent}>
              <h3>Run a job</h3>
              <div className="textSecondary">
                Pick a compute environment and run your own algorithm on it, paying only for what you use
              </div>
            </div>
            <div className={inferenceStyles.cardActions}>
              <Button contentAfter={<ArrowForwardIcon />} color="accent1" href={routes.runJob.path} variant="filled">
                Run a job
              </Button>
            </div>
          </Card>
          <Card
            className={inferenceStyles.card}
            direction="column"
            padding="md"
            radius="lg"
            shadow="black"
            spacing="md"
            variant="glass-shaded"
          >
            <div className={inferenceStyles.iconBox}>
              <DnsOutlinedIcon />
            </div>
            <div className={inferenceStyles.cardContent}>
              <h3>Run a node</h3>
              <div className="textSecondary">Set up your own Ocean Node, share your hardware, and earn rewards</div>
            </div>
            <div className={inferenceStyles.cardActions}>
              <Button contentAfter={<ArrowForwardIcon />} color="accent1" href={routes.runNode.path} variant="outlined">
                Run a node
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
};

export default ComputeIndexPage;
