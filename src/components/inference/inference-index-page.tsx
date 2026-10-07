import Button from '@/components/button/button';
import Container from '@/components/container/container';
import { EntryCard, EntryCardsLayout, FeaturedEntryCard } from '@/components/entry-cards/entry-cards';
import FlowSteps, { FlowStep } from '@/components/flow-steps/flow-steps';
import ExistingServicesTable from '@/components/inference/existing-services-table';
import SectionTitle from '@/components/section-title/section-title';
import { InferenceBranch, trackInferenceFlowStarted } from '@/lib/inference-analytics';
import { INFERENCE_PATHS } from '@/services/inference-url';
import { SHOWCASE_ITEMS } from '@/services/showcase';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';

const FLOW_STEPS: FlowStep[] = [
  { title: 'Pick a Model', description: 'Search the Hugging Face Hub' },
  { title: 'Choose Resources', description: 'Engine, session length and GPU' },
  { title: 'Configure Launch', description: 'Context, quantization, any flag' },
  { title: 'Fund the Session', description: 'One escrow confirmation' },
  { title: 'Call the Endpoint', description: 'OpenAI-compatible API, live logs' },
];

const BACKGROUND_MEDIA = SHOWCASE_ITEMS.slice(0, 6).map(({ type, src, poster, width, height }) => ({
  type,
  src,
  poster,
  width,
  height,
}));

const trackEntry = (branch: InferenceBranch) => {
  trackInferenceFlowStarted(branch, 'index');
};

const InferenceIndexPage: React.FC = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Inference" />
      <div className="pageContentWrapper">
        <FlowSteps steps={FLOW_STEPS} />
        <EntryCardsLayout
          featured={
            <FeaturedEntryCard
              actions={
                <Button
                  color="accent2"
                  href={INFERENCE_PATHS.templates}
                  onClick={() => trackEntry('template')}
                  size="lg"
                  variant="filled"
                >
                  Browse templates
                </Button>
              }
              badge="Fastest way to start"
              description="Ready-made bundles of an app and the models it needs. Pick one and start it in a few clicks, on a GPU picked for you."
              icon={<Inventory2OutlinedIcon />}
              backgroundMedia={BACKGROUND_MEDIA}
              title="Templates"
            />
          }
        >
          <EntryCard
            actions={
              <>
                <Button
                  color="accent1"
                  href="/inference/custom-models"
                  onClick={() => trackEntry('custom')}
                  size="md"
                  variant="transparent"
                >
                  Custom
                </Button>
                <Button
                  color="accent1"
                  href={INFERENCE_PATHS.packages}
                  onClick={() => trackEntry('quickstart')}
                  size="md"
                  variant="outlined"
                >
                  Curated
                </Button>
              </>
            }
            description="Run a curated model, or bring any compatible model from Hugging Face with your own settings."
            icon={<AutoAwesomeOutlinedIcon />}
            title="Models"
          />
          <EntryCard
            actions={
              <Button
                color="accent1"
                href={INFERENCE_PATHS.services}
                onClick={() => trackEntry('service')}
                size="md"
                variant="outlined"
              >
                Browse services
              </Button>
            }
            description="Start an app like ComfyUI, Open WebUI or JupyterLab and add your own models."
            icon={<WidgetsOutlinedIcon />}
            title="Services"
          />
        </EntryCardsLayout>
        <ExistingServicesTable />
      </div>
    </Container>
  );
};

export default InferenceIndexPage;
