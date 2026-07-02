import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import SelectInferenceEnvironment from '@/components/inference/select-inference-environment';
import SectionTitle from '@/components/section-title/section-title';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { useInferenceContext } from '@/context/inference-context';
import { InferenceFlowType } from '@/types/inference';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';

const ResourcesPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const router = useRouter();
  const params = useParams<{ modelId?: string; templateId?: string }>();

  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel;

  const { selectedModels, selectedEnv, hydrateFromUrlFinished, buildSelectionQuery } = useInferenceContext();

  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        // Keep the selection in the URL so a refresh on the model-picker restores it.
        router.replace({ pathname: '/inference/custom-models', query: router.query });
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

  // `picked` carries the just-selected env/token/gpu when coming from an env card, because context
  // state hasn't settled yet in the same tick; the bottom-nav "Skip" path calls without it.
  const goToNextStep = (picked?: {
    peerId: string;
    envId: string;
    tokenAddress: string;
    gpuSelection: GpuSelection;
  }) => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.push({
          pathname: '/inference/custom-models/config',
          query: { ...router.query, ...buildSelectionQuery(picked) },
        });
        break;
      }
      case InferenceFlowType.DefaultModel: {
        router.push(`/inference/default-models/${encodeURIComponent(params.modelId ?? '')}/payment`);
        break;
      }
      case InferenceFlowType.Template: {
        router.push(`/inference/templates/${encodeURIComponent(params.templateId ?? '')}/config`);
        break;
      }
    }
  };

  const resolving = !hydrateFromUrlFinished;
  const hasModels = selectedModels.length > 0;

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch a model on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="resources" flowType={flowType} />}
      />
      <div className="pageContentWrapper">
        {isCustomModelFlow ? (
          <>
            {resolving && (
              <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
                <div className="textSecondary">Loading selected models…</div>
              </Card>
            )}
            {!resolving && hasModels && <SelectInferenceEnvironment onEnvSelected={goToNextStep} />}
          </>
        ) : (
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <h3>{flowType} - Resources</h3>
          </Card>
        )}

        <InferenceNavigation nextLabel="Skip" onNext={selectedEnv ? () => goToNextStep() : undefined} onPrev={goToPrevStep} />
      </div>
    </Container>
  );
};

export default ResourcesPage;
