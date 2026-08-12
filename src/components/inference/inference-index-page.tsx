import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import ExistingServicesTable from '@/components/inference/existing-services-table';
import SectionTitle from '@/components/section-title/section-title';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
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
              <h3>Models</h3>
              <div className="textSecondary">
                Run a curated model, or bring any model from Hugging Face with your own settings
              </div>
            </div>
            <div className={styles.cardActions}>
              <Button color="accent1" href="/inference/custom-models" variant="outlined">
                Custom
              </Button>
              <Button color="accent1" href="/inference/default-models" variant="filled">
                Curated
              </Button>
            </div>
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
              <WidgetsOutlinedIcon />
            </div>
            <div className={styles.cardContent}>
              <h3>Services</h3>
              <div className="textSecondary">
                Start a ready-made app — ComfyUI, Open WebUI, JupyterLab — and add your own models
              </div>
            </div>
            <div className={styles.cardActions}>
              <Button contentAfter={<ArrowForwardIcon />} color="accent1" href="/inference/services" variant="outlined">
                Browse services
              </Button>
            </div>
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
                Start your workflow with our ready-made bundles of models and services
              </div>
            </div>
            <div className={styles.cardActions}>
              <Button
                contentAfter={<ArrowForwardIcon />}
                color="accent1"
                href="/inference/templates"
                variant="outlined"
              >
                Browse templates
              </Button>
            </div>
          </Card>
        </div>
        <ExistingServicesTable />
      </div>
    </Container>
  );
};

export default InferenceIndexPage;
