import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import SelectInferenceEnvironment from '@/components/inference/select-inference-environment';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { decodeModelIds, encodeModelIds, fetchHuggingFaceModel } from '@/services/huggingface-service';
import { InferenceFlowType } from '@/types/inference';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

const ResourcesPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const router = useRouter();
  const params = useParams<{ modelId?: string; templateId?: string }>();

  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel;

  const { selectedModels, setSelectedModels, selectedEnv } = useInferenceContext();

  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Custom flow carries the selected model ids in the `models` query param.
  const routeModelIds = useMemo(() => decodeModelIds(router.query.models), [router.query.models]);

  // On hard reload context is empty — re-resolve the selected models from the query.
  useEffect(() => {
    if (!isCustomModelFlow || routeModelIds.length === 0) {
      return;
    }
    const selectedIds = selectedModels.map((m) => m.id);
    const sameSelection =
      selectedIds.length === routeModelIds.length && routeModelIds.every((id) => selectedIds.includes(id));
    if (sameSelection) {
      return;
    }

    let cancelled = false;
    setResolving(true);
    setResolveError(null);

    Promise.all(routeModelIds.map((id) => fetchHuggingFaceModel(id)))
      .then((models) => {
        if (!cancelled) {
          setSelectedModels(models);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResolveError(err instanceof Error ? err.message : 'Failed to load the selected models.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCustomModelFlow, routeModelIds, selectedModels, setSelectedModels]);

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
        router.push(`/inference/custom-models/config?models=${encodeModelIds(routeModelIds)}`);
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
            {resolveError && (
              <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
                <div className="textAccent1">{resolveError}</div>
              </Card>
            )}
            {!resolving && !resolveError && hasModels && <SelectInferenceEnvironment onEnvSelected={goToNextStep} />}
          </>
        ) : (
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <h3>{flowType} - Resources</h3>
          </Card>
        )}

        <InferenceNavigation nextLabel="Skip" onNext={selectedEnv ? goToNextStep : undefined} onPrev={goToPrevStep} />
      </div>
    </Container>
  );
};

export default ResourcesPage;
