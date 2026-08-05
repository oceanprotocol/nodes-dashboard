import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import ExistingServicesTable from '@/components/inference/existing-services-table';
import SectionTitle from '@/components/section-title/section-title';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import classNames from 'classnames';
import styles from './inference-index-page.module.css';

const InferenceIndexPage: React.FC = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Inference" subTitle="Launch a model on an Ocean Node" />
      <div className="pageContentWrapper">
        <div className={styles.cards}>
          <Card
            className={classNames(styles.card, styles.cardHighlighted)}
            direction="column"
            padding="md"
            radius="lg"
            shadow="accent1"
            spacing="md"
            variant="glass-shaded"
          >
            <div className={styles.iconBox}>
              <AutoAwesomeOutlinedIcon />
            </div>
            <div className={styles.cardContent}>
              <h3>Quick start</h3>
              <div className="textSecondary">
                Choose from a list of curated models, preconfigured for optimal performance
              </div>
            </div>
            <Button
              contentAfter={<ArrowForwardIcon />}
              color="accent1"
              href="/inference/default-models"
              variant="filled"
            >
              Select a model
            </Button>
          </Card>
          <Card
            className={styles.card}
            direction="column"
            padding="md"
            radius="lg"
            shadow="black"
            spacing="md"
            variant="glass-shaded"
          >
            <div className={styles.iconBox}>
              <TuneOutlinedIcon />
            </div>
            <div className={styles.cardContent}>
              <h3>Custom model</h3>
              <div className="textSecondary">Pull any model from Hugging Face, set your own parameters & resources</div>
            </div>
            <Button
              contentAfter={<ArrowForwardIcon />}
              color="accent1"
              href="/inference/custom-models"
              variant="outlined"
            >
              Start custom
            </Button>
          </Card>
          <Card
            className={styles.card}
            direction="column"
            padding="md"
            radius="lg"
            shadow="black"
            spacing="md"
            variant="glass-shaded"
          >
            <div className={styles.iconBox}>
              <DashboardCustomizeOutlinedIcon />
            </div>
            <div className={styles.cardContent}>
              <h3>Services</h3>
              <div className="textSecondary">
                Start a ready-made app — ComfyUI, Open WebUI, JupyterLab — and add your own models
              </div>
            </div>
            <Button
              contentAfter={<ArrowForwardIcon />}
              color="accent1"
              href="/inference/services"
              variant="outlined"
            >
              Browse services
            </Button>
          </Card>
          <Card
            className={styles.card}
            direction="column"
            padding="md"
            radius="lg"
            shadow="black"
            spacing="md"
            variant="glass-shaded"
          >
            <div className={styles.iconBox}>
              <Inventory2OutlinedIcon />
            </div>
            <div className={styles.cardContent}>
              <h3>Templates</h3>
              <div className="textSecondary">
                The same apps with their models already included — pick an outcome, skip the setup
              </div>
            </div>
            <Button
              contentAfter={<ArrowForwardIcon />}
              color="accent1"
              href="/inference/templates"
              variant="outlined"
            >
              Browse templates
            </Button>
          </Card>
        </div>
        <ExistingServicesTable />
      </div>
    </Container>
  );
};

export default InferenceIndexPage;
