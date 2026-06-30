import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceStepper from '@/components/inference/inference-stepper';
import SectionTitle from '@/components/section-title/section-title';
import { InferenceFlowType } from '@/types/inference';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';

const ResourcesPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const router = useRouter();
  const params = useParams<{ modelId?: string; templateId?: string }>();

  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.replace('/inference/custom-models');
        break;
      }
      case InferenceFlowType.DefaultModel: {
        router.replace('/inference/default-models');
        break;
      }
      case InferenceFlowType.Template: {
        router.replace('/inference/templates');
        break;
      }
    }
  };

  const goToNextStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.push(`/inference/custom-models/${params.modelId}/config`);
        break;
      }
      case InferenceFlowType.DefaultModel: {
        router.push(`/inference/default-models/${params.modelId}/payment`);
        break;
      }
      case InferenceFlowType.Template: {
        router.push(`/inference/templates/${params.templateId}/config`);
        break;
      }
    }
  };

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch a model on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="resources" flowType={flowType} />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <h3>{flowType} - Resources</h3>
          <div className="actionsGroupLgBetween">
            <Button color="accent1" onClick={goToPrevStep} size="lg" variant="transparent">
              Go back
            </Button>
            <Button color="accent1" onClick={goToNextStep} size="lg">
              Continue
            </Button>
          </div>
        </Card>
      </div>
    </Container>
  );
};

export default ResourcesPage;
