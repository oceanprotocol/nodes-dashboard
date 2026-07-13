import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceHydrationError from '@/components/inference/inference-hydration-error';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import ModelParameters, { ModelParametersHandle } from '@/components/inference/model-parameters';
import Input from '@/components/input/input';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { ModelParameters as ModelParametersType } from '@/types/huggingface';
import { InferenceFlowType } from '@/types/inference';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

const ConfigPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const params = useParams<{ modelId?: string; templateId?: string }>();
  const router = useRouter();
  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel;
  // Editing a running service: env step was skipped, so prev goes back to the model picker.
  const isEditMode = router.query.edit === '1';
  const {
    hfToken,
    setHfToken,
    setParamsForModel,
    selectedModels,
    selectedEnv,
    hydrateFromUrlFinished,
    hydrationFailed,
    buildSelectionQuery,
  } = useInferenceContext();
  // Selected models come from context (hydrated centrally from the query params on reload).
  const modelIds = useMemo(() => selectedModels.map((m) => m.id), [selectedModels]);
  const paramRefs = useRef<Record<string, ModelParametersHandle | null>>({});
  const resolvingModels = !hydrateFromUrlFinished;
  // Surfaced when submit can't proceed for a reason that isn't a per-field validation error.
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Bounce back to the earliest step whose input is missing if we landed here (deep link / refresh)
  // without a complete selection: no models → picker, models but no env → resources. Skipped when
  // hydration failed — we show a retry instead of discarding the URL selection.
  useEffect(() => {
    if (!isCustomModelFlow || !hydrateFromUrlFinished || hydrationFailed) {
      return;
    }
    if (selectedModels.length === 0) {
      router.replace({ pathname: '/inference/custom-models', query: router.query });
    } else if (!selectedEnv && !isEditMode) {
      // In edit mode the env is inherited from the running service and the resources step is skipped.
      router.replace({ pathname: '/inference/custom-models/resources', query: router.query });
    }
  }, [isCustomModelFlow, hydrateFromUrlFinished, hydrationFailed, selectedModels.length, selectedEnv, isEditMode, router]);

  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        // Edit re-entry skipped the resources step, so step back to the model picker instead.
        const pathname = isEditMode ? '/inference/custom-models' : '/inference/custom-models/resources';
        router.replace({ pathname, query: router.query });
        break;
      }
      case InferenceFlowType.Template: {
        router.replace(`/inference/templates/${encodeURIComponent(params.templateId ?? '')}/resources`);
        break;
      }
    }
  };

  // Commit validated params (passed as override so the fresh values are in the URL immediately) and advance.
  const goToNextStep = (modelParamsByModel?: Record<string, ModelParametersType>) => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.push({
          pathname: '/inference/custom-models/payment',
          query: { ...router.query, ...buildSelectionQuery({ modelParamsByModel }) },
        });
        break;
      }
      case InferenceFlowType.Template: {
        router.push(`/inference/templates/${encodeURIComponent(params.templateId ?? '')}/payment`);
        break;
      }
    }
  };

  // Re-fetch HF defaults for every model card (e.g. after entering a token that unlocks gated repos).
  const reloadDefaults = () => {
    modelIds.forEach((id) => paramRefs.current[id]?.reloadDefaults());
  };

  // Validate + commit every model's params, then advance. Any invalid card aborts navigation.
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    if (isCustomModelFlow) {
      // A card still mounting (loading its HF config) has no imperative handle yet — treat that as
      // "not ready" and tell the user, rather than silently doing nothing when they click Next.
      if (modelIds.some((id) => !paramRefs.current[id])) {
        setSubmitError('Some models are still loading their defaults. Wait a moment, then try again.');
        return;
      }
      const results = await Promise.all(modelIds.map((id) => paramRefs.current[id]!.validateAndGet()));
      // A null result here means a card failed its own validation and already highlighted its fields.
      if (results.some((params) => !params)) {
        setSubmitError('Fix the highlighted parameters before continuing.');
        return;
      }
      const paramsByModel: Record<string, ModelParametersType> = {};
      modelIds.forEach((id, index) => {
        setParamsForModel(id, results[index]!);
        paramsByModel[id] = results[index]!;
      });
      goToNextStep(paramsByModel);
      return;
    }
    goToNextStep();
  };

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch a model on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="config" edit={isEditMode} flowType={flowType} />}
      />
      {resolvingModels || hydrationFailed ? (
        <div className="pageContentWrapper">
          {resolvingModels ? (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <div className="textSecondary">Loading selected models…</div>
            </Card>
          ) : (
            <InferenceHydrationError />
          )}
        </div>
      ) : (
        <form className="pageContentWrapper" onSubmit={handleSubmit}>
          {isCustomModelFlow ? (
            <>
              <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
                <div>
                  <h3>General</h3>
                  <div className="textSecondary">Shared across all models</div>
                </div>
                <Input
                  endAdornment={
                    <Button color="accent1" onClick={reloadDefaults} size="sm" type="button" variant="outlined">
                      Reload defaults
                    </Button>
                  }
                  name="hfToken"
                  label={
                    <div>
                      Hugging Face token{' '}
                      <Tooltip title="Your Hugging Face access token. Used to download gated or private model repos. Shared across all selected models. Only needed if a model is access-restricted.">
                        <InfoOutlinedIcon className="textAccent1" fontSize="small" />
                      </Tooltip>
                    </div>
                  }
                  onChange={(e) => setHfToken(e.target.value)}
                  placeholder="hf_…"
                  size="md"
                  type="password"
                  value={hfToken}
                />
              </Card>
              {modelIds.map((id) => (
                <ModelParameters
                  defaultOpen={false}
                  key={id}
                  modelId={id}
                  ref={(handle) => {
                    paramRefs.current[id] = handle;
                  }}
                />
              ))}
            </>
          ) : (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <h3>{flowType} - Config</h3>
            </Card>
          )}

          {submitError && <div className="textAccent1">{submitError}</div>}

          <InferenceNavigation nextButtonHtmlType="submit" onPrev={goToPrevStep} showNext />
        </form>
      )}
    </Container>
  );
};

export default ConfigPage;
