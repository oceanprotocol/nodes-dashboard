import Button from '@/components/button/button';
import Container from '@/components/container/container';
import { EntryCard, EntryCardsLayout, FeaturedEntryCard } from '@/components/entry-cards/entry-cards';
import FlowSteps, { FlowStep } from '@/components/flow-steps/flow-steps';
import ConsumerJobs from '@/components/profile/consumer-jobs';
import SectionTitle from '@/components/section-title/section-title';
import { getRoutes } from '@/config';
import { MyJobsTableProvider } from '@/context/table/my-jobs-table-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';
import styles from './compute-index-page.module.css';

const FLOW_STEPS: FlowStep[] = [
  { title: 'Select Environment', description: 'Filter by hardware, location, price' },
  { title: 'Define Resources', description: 'Container, params and resources' },
  { title: 'Fund the Job', description: 'Escrow, with a cost estimate' },
  { title: 'Run Job', description: 'Live status and logs' },
  { title: 'Get Results', description: 'Logs and outputs returned' },
];

const NODE_STEPS = [
  'Install Ocean Node with Docker',
  'Connect to it and configure it here',
  'Start running compute jobs',
];

const ComputeIndexPage: React.FC = () => {
  const routes = getRoutes();
  const { account } = useOceanAccount();

  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Compute" />
      <div className="pageContentWrapper">
        <FlowSteps steps={FLOW_STEPS} />
        <EntryCardsLayout
          featured={
            <FeaturedEntryCard
              actions={
                <Button color="accent2" href={routes.runJob.path} size="lg" variant="filled">
                  Run a job
                </Button>
              }
              badge="Free test compute available"
              description="Pick a compute environment and run your own algorithm on it, paying only for what you use."
              icon={<TerminalOutlinedIcon />}
              title="Run a job"
            />
          }
        >
          <EntryCard
            actions={
              <Button color="accent1" href={routes.runNode.path} size="md" variant="outlined">
                Run a node
              </Button>
            }
            description="Set up your own Ocean Node and share your hardware with the network."
            icon={<DnsOutlinedIcon />}
            title="Run a node"
          >
            <ol className={styles.nodeSteps}>
              {NODE_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </EntryCard>
        </EntryCardsLayout>
        {account.address ? (
          <MyJobsTableProvider consumer={account.address}>
            <ConsumerJobs />
          </MyJobsTableProvider>
        ) : null}
      </div>
    </Container>
  );
};

export default ComputeIndexPage;
