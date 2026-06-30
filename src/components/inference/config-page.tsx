import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceStepper from '@/components/inference/inference-stepper';
import SectionTitle from '@/components/section-title/section-title';
import { InferenceFlowType } from '@/types/inference';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';

const ConfigPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const params = useParams<{ modelId?: string; templateId?: string }>();
  const router = useRouter();

  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.replace(`/inference/custom-models/${params.modelId}/resources`);
        break;
      }
      case InferenceFlowType.Template: {
        router.replace(`/inference/templates/${params.templateId}/resources`);
        break;
      }
    }
  };

  const goToNextStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.push(`/inference/custom-models/${params.modelId}/payment`);
        break;
      }
      case InferenceFlowType.Template: {
        router.push(`/inference/templates/${params.templateId}/payment`);
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
        contentBetween={<InferenceStepper currentStep="config" flowType={flowType} />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <h3>{flowType} - Config</h3>
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

export default ConfigPage;
