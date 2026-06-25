import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceStepper from '@/components/inference/inference-stepper';
import SectionTitle from '@/components/section-title/section-title';
import { InferenceFlowType } from '@/types/inference';
import { useRouter } from 'next/router';

const CustomModelsPage: React.FC = () => {
  const router = useRouter();

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch a model on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="model" flowType={InferenceFlowType.CustomModel} />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <h3>Custom models</h3>
          <div className="actionsGroupLgBetween">
            <Button color="accent1" onClick={() => router.replace('/inference')} size="lg" variant="transparent">
              Go back
            </Button>
            <Button color="accent1" href="/inference/custom-models/model-id/resources" size="lg">
              Continue
            </Button>
          </div>
        </Card>
      </div>
    </Container>
  );
};

export default CustomModelsPage;
