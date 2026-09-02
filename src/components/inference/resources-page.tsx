import Card from '@/components/card/card';
import Container from '@/components/container/container';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import InferenceHydrationError from '@/components/inference/inference-hydration-error';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import SelectInferenceEnvironment, {
  InferenceSelectionEstimate,
} from '@/components/inference/select-inference-environment';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { resolveInferenceBranch } from '@/lib/inference-analytics';
import { templateNeedsConfigStep, templatePinnedSizing } from '@/services/template-launch';
import { InferenceFlowType } from '@/types/inference';
import { isBundle } from '@/types/templates';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useMemo } from 'react';

const ResourcesPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const router = useRouter();
  const params = useParams<{ modelId?: string; templateId?: string }>();

  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel;
  const isTemplateFlow = flowType === InferenceFlowType.Template;
  const isEnvPickerFlow = isCustomModelFlow || isTemplateFlow;

  const {
    selectedModels,
    selectedEnv,
    selectedTemplate,
    jobDurationSeconds,
    hydrateFromUrlFinished,
    hydrationFailed,
    buildSelectionQuery,
  } = useInferenceContext();
  // Computed once — reused by the stepper and the next-step routing below.
  const needsConfigStep = templateNeedsConfigStep(selectedTemplate);
  const branch = useMemo(() => resolveInferenceBranch(flowType, selectedTemplate), [flowType, selectedTemplate]);

  // Bounce back to the picker if we landed here (deep link / refresh) with nothing selected — but not
  // when hydration outright failed, where we show a retry instead of discarding the URL.
  useEffect(() => {
    if (!hydrateFromUrlFinished || hydrationFailed) {
      return;
    }
    if (isCustomModelFlow && selectedModels.length === 0) {
      router.replace({ pathname: '/inference/custom-models', query: router.query });
    } else if (isTemplateFlow && !selectedTemplate) {
      // No template named in the query OR the path — nothing to classify, so the hub (see payment-page).
      router.replace('/inference');
    }
  }, [
    isCustomModelFlow,
    isTemplateFlow,
    hydrateFromUrlFinished,
    hydrationFailed,
    selectedModels.length,
    selectedTemplate,
    router,
  ]);

  // The quick-start (DefaultModel) flow has no resources step — its package bundles the hardware
  // and the env auto-matches on the package step — so only the custom & template flows route here.
  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        // Keep the selection in the URL so a refresh on the model-picker restores it.
        router.replace({ pathname: '/inference/custom-models', query: router.query });
        break;
      }
      case InferenceFlowType.Template: {
        // Back to the catalogue this template actually belongs to: a bundle is listed on
        // `/inference/templates` and never on `/inference/services` (see catalogue-config), so the
        // fixed target used to strand a bundle launch on a grid without it. Here — unlike the bounce
        // guard above — the template IS resolved, so `isBundle` can answer.
        router.replace(selectedTemplate && isBundle(selectedTemplate) ? '/inference/templates' : '/inference/services');
        break;
      }
    }
  };

  // `picked` carries the just-selected env/token/gpu when coming from an env card, because context
  // state hasn't settled yet in the same tick; the bottom-nav "Skip" path calls without it.
  const goToNextStep = (
    picked?: {
      peerId: string;
      envId: string;
      tokenAddress: string;
      gpuSelection: GpuSelection;
    },
    // Resources of the allocation just picked. Comes from the picker because `selectedEnv` still holds
    // the previous env this tick — deriving from it would report the wrong (or no) hardware.
    estimate?: InferenceSelectionEstimate
  ) => {
    // Skip path only: no pick to describe, so fall back to the settled env's capacity.
    const envResources = selectedEnv?.environment.resources;
    const capacityOf = (type: string) => envResources?.find((res) => res.type === type || res.id === type)?.max;
    const gpuCount =
      estimate?.gpuCount ?? Object.values(selectedEnv?.gpuSelection ?? {}).reduce((sum, n) => sum + n, 0);
    const trackNextStep = (nextStep: 'config' | 'payment') => {
      posthog.capture('inference_resources_configured', {
        nodeId: picked?.peerId ?? selectedEnv?.nodeInfo.id,
        environmentId: picked?.envId ?? selectedEnv?.environment.id,
        gpuCount,
        cpu: estimate?.cpu ?? capacityOf('cpu'),
        ram: estimate?.ram ?? capacityOf('ram'),
        disk: estimate?.disk ?? capacityOf('disk'),
        gpuTypes: estimate?.gpuTypes,
        durationSeconds: jobDurationSeconds,
        flowType,
        nextStep,
        skipped: !picked,
        branch,
      });
    };
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        trackNextStep('config');
        router.push({
          pathname: '/inference/custom-models/config',
          query: { ...router.query, ...buildSelectionQuery(picked) },
        });
        break;
      }
      case InferenceFlowType.Template: {
        // Config is skipped on a fresh launch unless templateNeedsConfigStep — a required env var has
        // to be filled or the container fails, and the bucket pick has to happen before payment, since
        // a bad bucket id costs the escrow claim, not just a failed page load.
        // Pin recommended CPU/RAM/disk into the URL either way (re-hydrated from the query on arrival).
        const sizing = selectedTemplate ? templatePinnedSizing(selectedTemplate) : undefined;
        const nextStep = needsConfigStep ? 'config' : 'payment';
        trackNextStep(nextStep);
        router.push({
          pathname: `/inference/services/${encodeURIComponent(params.templateId ?? '')}/${nextStep}`,
          query: { ...router.query, ...buildSelectionQuery({ ...picked, sizing }) },
        });
        break;
      }
    }
  };

  const resolving = !hydrateFromUrlFinished;
  // Both env-picker flows need something selected before the picker is meaningful: the custom flow a
  // model, the template flow a template.
  const hasSelectionForFlow = isCustomModelFlow ? selectedModels.length > 0 : !!selectedTemplate;

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch on an Ocean Node"
        contentBetween={
          <InferenceStepper
            currentStep="resources"
            flowType={flowType}
            template={selectedTemplate}
            showTemplateConfig={needsConfigStep}
          />
        }
      />
      <div className="pageContentWrapper">
        {isEnvPickerFlow ? (
          <>
            {resolving ? (
              <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
                <div className="textSecondary">Loading selection…</div>
              </Card>
            ) : hydrationFailed ? (
              <InferenceHydrationError />
            ) : (
              hasSelectionForFlow && (
                <>
                  <SelectInferenceEnvironment flowType={flowType} onEnvSelected={goToNextStep} />
                  <InferenceNavigation
                    nextLabel="Skip"
                    onNext={selectedEnv ? () => goToNextStep() : undefined}
                    onPrev={goToPrevStep}
                  />
                </>
              )
            )}
          </>
        ) : (
          <>
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <h3>{flowType} - Resources</h3>
            </Card>
          </>
        )}
      </div>
    </Container>
  );
};

export default ResourcesPage;
