import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferencePayment from '@/components/inference/inference-payment';
import InferenceStepper from '@/components/inference/inference-stepper';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { getModelShortName } from '@/services/huggingface-service';
import { InferenceFlowType } from '@/types/inference';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';

const PaymentPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const params = useParams<{ modelId?: string; templateId?: string }>();
  const router = useRouter();
  const { selectedEnv, selectedToken, jobDurationSeconds, selectedModels, hydrateFromUrlFinished } =
    useInferenceContext();

  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.replace({ pathname: '/inference/custom-models/config', query: router.query });
        break;
      }
      case InferenceFlowType.DefaultModel: {
        router.replace(`/inference/default-models/${encodeURIComponent(params.modelId ?? '')}/resources`);
        break;
      }
      case InferenceFlowType.Template: {
        router.replace(`/inference/templates/${encodeURIComponent(params.templateId ?? '')}/config`);
        break;
      }
    }
  };

  const goToNextStep = () => {
    // Mock service id from the first selected model until launch returns a real id.
    const firstModel = selectedModels[0]?.id ?? '';
    const serviceId = getModelShortName(firstModel) || 'service';
    router.push(`/inference/services/${encodeURIComponent(serviceId)}`);
  };

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch a model on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="payment" flowType={flowType} />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <h3>Payment</h3>
          {!hydrateFromUrlFinished ? (
            <div className="textSecondary">Loading selection…</div>
          ) : selectedEnv && selectedToken ? (
            <InferencePayment
              durationSeconds={jobDurationSeconds}
              selectedEnv={selectedEnv}
              selectedToken={selectedToken}
            />
          ) : (
            <div className="textSecondary">Select an environment first.</div>
          )}
        </Card>

        <InferenceNavigation nextLabel="Pay & launch" onNext={goToNextStep} onPrev={goToPrevStep} />
      </div>
    </Container>
  );
};

export default PaymentPage;
