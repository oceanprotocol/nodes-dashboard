import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import InferenceModelList, { fallbackParams, ServiceModel } from '@/components/inference/inference-model-list';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferencePayment from '@/components/inference/inference-payment';
import InferenceStepper from '@/components/inference/inference-stepper';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { getModelShortName } from '@/services/huggingface-service';
import { InferenceFlowType } from '@/types/inference';
import { formatDuration } from '@/utils/formatters';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import styles from './payment-page.module.css';

const PaymentPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const params = useParams<{ modelId?: string; templateId?: string }>();
  const router = useRouter();
  const {
    selectedEnv,
    selectedToken,
    jobDurationSeconds,
    selectedModels,
    modelParamsByModel,
    hydrateFromUrlFinished,
    buildSelectionQuery,
  } = useInferenceContext();

  // Selected models paired with their committed launch params (falling back where none are set).
  const models: ServiceModel[] = useMemo(
    () =>
      selectedModels.map((model) => ({
        model,
        params: modelParamsByModel[model.id] ?? fallbackParams(model.id),
      })),
    [selectedModels, modelParamsByModel]
  );

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
    // Carry the whole selection on the query so the (mock) manage page can display it.
    router.push({
      pathname: `/inference/services/${encodeURIComponent(serviceId)}`,
      query: buildSelectionQuery(),
    });
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
        {!hydrateFromUrlFinished ? (
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <div className="textSecondary">Loading selection…</div>
          </Card>
        ) : (
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            {/* Payment summary */}
            {selectedEnv && selectedToken ? (
              <InferencePayment
                durationSeconds={jobDurationSeconds}
                selectedEnv={selectedEnv}
                selectedToken={selectedToken}
              />
            ) : (
              <div className="textSecondary">Select an environment first.</div>
            )}

            {/* Models */}
            {models.length > 0 && (
              <>
                <div className={styles.sectionHead}>
                  <h3>Models</h3>
                  <span className="textSecondary">{models.length} selected · expand for launch parameters</span>
                </div>
                <InferenceModelList models={models} />
              </>
            )}
            {/* Environment */}
            {selectedEnv && (
              <>
                <div className={styles.sectionHead}>
                  <h3>Environment</h3>
                  <span className="textSecondary">Running for {formatDuration(jobDurationSeconds)}</span>
                </div>
                <InferenceEnvironmentCard
                  defaultToken={selectedToken?.address}
                  durationSeconds={jobDurationSeconds}
                  environment={selectedEnv.environment}
                  gpuSelection={selectedEnv.gpuSelection}
                  nodeInfo={selectedEnv.nodeInfo}
                />
              </>
            )}
          </Card>
        )}

        <InferenceNavigation hideSelection nextLabel="Pay & launch" onNext={goToNextStep} onPrev={goToPrevStep} />
      </div>
    </Container>
  );
};

export default PaymentPage;
