import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceHydrationError from '@/components/inference/inference-hydration-error';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import ModelParameters, { ModelParametersHandle } from '@/components/inference/model-parameters';
import TemplateBucketPicker from '@/components/inference/template-bucket-picker';
import Input from '@/components/input/input';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { captureError } from '@/lib/analytics';
import { resolveInferenceBranch } from '@/lib/inference-analytics';
import { templateNeedsBucketPicker, WORKFLOW_ENV_VAR_KEYS } from '@/services/template-launch';
import { ModelParameters as ModelParametersType } from '@/types/huggingface';
import { InferenceFlowType } from '@/types/inference';
import { includesSummary, isBundle, validateEnvValue } from '@/types/templates';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useMemo, useRef, useState } from 'react';

const ConfigPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const params = useParams<{ modelId?: string; templateId?: string }>();
  const router = useRouter();
  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel;
  const isTemplateFlow = flowType === InferenceFlowType.Template;
  // Editing a running service: env step was skipped, so prev goes back to the model picker.
  const isEditMode = router.query.edit === '1';
  const {
    hfToken,
    setHfToken,
    setParamsForModel,
    selectedModels,
    selectedEnv,
    selectedTemplate,
    selectedBucketId,
    setSelectedBucketId,
    templateEnvValues,
    setTemplateEnvValues,
    engine,
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

  // Computed once — reused by the bounce guard, the stepper and the picker/message render below.
  const needsBucketPicker = templateNeedsBucketPicker(selectedTemplate);
  const branch = useMemo(() => resolveInferenceBranch(flowType, selectedTemplate), [flowType, selectedTemplate]);
  // Whether the bucket picker is actually shown on this page (edit re-entry never shows it — see the
  // guard on TemplateBucketPicker below).
  const showsPicker = !isEditMode && needsBucketPicker;

  // Template flow: live values for the template's userConfigurableEnvVars, seeded from context (so a
  // back-nav keeps what was typed) and per-field validation errors. Secrets — never leave the client.
  // Excludes the workflow env vars (COMFY_WORKFLOW_ID / COMFY_WORKFLOW) — those are set automatically
  // from the template's workflows at launch, so a free-text box for them would just be overwritten.
  const envSpecs = useMemo(
    () => (selectedTemplate?.userConfigurableEnvVars ?? []).filter((spec) => !WORKFLOW_ENV_VAR_KEYS.includes(spec.key)),
    [selectedTemplate]
  );
  const [envInputs, setEnvInputs] = useState<Record<string, string>>({});
  const [envErrors, setEnvErrors] = useState<Record<string, string>>({});
  // Cost of relaunching a bundle: everything it ships with is fetched again inside the paid window.
  // Counted by includesSummary, so the noun stays honest for a bundle that ships workflows or nodes.
  const bundleReloadNote = useMemo(() => {
    if (!selectedTemplate || !isBundle(selectedTemplate)) {
      return null;
    }
    const included = includesSummary(selectedTemplate);
    if (!included) {
      return null;
    }
    return `Relaunching re-downloads all ${included} — inside the session you have already paid for.`;
  }, [selectedTemplate]);
  useEffect(() => {
    if (isTemplateFlow) {
      setEnvInputs(templateEnvValues);
    }
  }, [isTemplateFlow, templateEnvValues]);

  // Bounce back to the earliest step whose input is missing if we landed here (deep link / refresh)
  // without a complete selection: no models → picker, models but no env → resources. Skipped when
  // hydration failed — we show a retry instead of discarding the URL selection.
  useEffect(() => {
    if (!hydrateFromUrlFinished || hydrationFailed) {
      return;
    }
    if (isCustomModelFlow) {
      if (selectedModels.length === 0) {
        router.replace({ pathname: '/inference/custom-models', query: router.query });
      } else if (!selectedEnv && !isEditMode) {
        // In edit mode the env is inherited from the running service and the resources step is skipped.
        router.replace({ pathname: '/inference/custom-models/resources', query: router.query });
      }
    } else if (isTemplateFlow) {
      if (!selectedTemplate) {
        // The URL named no template in either place — neither the query nor the `[templateId]` path
        // segment (hydration reads both; an id it can't resolve fails hydration, which this guard
        // skips). With no id to classify, the hub is the only honest destination — see payment-page.
        router.replace('/inference');
      } else if (!selectedEnv && !isEditMode && needsBucketPicker) {
        // A template needing the bucket picker requires selectedEnv (its nodeInfo) to render one —
        // without it (deep link / refresh with no peerId/env) this page would show an empty card that
        // still lets Next through to payment with no bucket. Back to resources to pick an env first.
        router.replace({
          pathname: `/inference/services/${encodeURIComponent(params.templateId ?? '')}/resources`,
          query: router.query,
        });
      }
    }
  }, [
    isCustomModelFlow,
    isTemplateFlow,
    hydrateFromUrlFinished,
    hydrationFailed,
    selectedModels.length,
    selectedEnv,
    selectedTemplate,
    needsBucketPicker,
    isEditMode,
    params.templateId,
    router,
  ]);

  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        // Edit re-entry skipped the resources step, so step back to the model picker instead.
        const pathname = isEditMode ? '/inference/custom-models' : '/inference/custom-models/resources';
        router.replace({ pathname, query: router.query });
        break;
      }
      case InferenceFlowType.Template: {
        // Edit re-entry skipped the resources step (env inherited from the running service) → step back
        // to the manage page instead of the resources picker.
        const serviceId = Array.isArray(router.query.serviceId) ? router.query.serviceId[0] : router.query.serviceId;
        if (isEditMode && serviceId) {
          router.replace(`/inference/instances/${encodeURIComponent(serviceId)}`);
        } else {
          router.replace({
            pathname: `/inference/services/${encodeURIComponent(params.templateId ?? '')}/resources`,
            query: router.query,
          });
        }
        break;
      }
    }
  };

  // Commit validated params (passed as override so the fresh values are in the URL immediately) and advance.
  // `envVarCount` is passed explicitly for the template branch — `templateEnvValues` in context is
  // stale in the same tick `setTemplateEnvValues` committed it, since state updates aren't synchronous.
  const goToNextStep = (modelParamsByModel?: Record<string, ModelParametersType>, envVarCount?: number) => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        posthog.capture('inference_config_submitted', {
          flowType,
          modelCount: modelIds.length,
          engine,
          hasHfToken: !!hfToken,
          isEditMode,
          branch,
        });
        router.push({
          pathname: '/inference/custom-models/payment',
          query: { ...router.query, ...buildSelectionQuery({ modelParamsByModel }) },
        });
        break;
      }
      case InferenceFlowType.Template: {
        // Carry the whole query (edit / serviceId / template) so payment relaunches the right running
        // service. Template env values live in context (secrets — never in the URL).
        posthog.capture('inference_config_submitted', {
          flowType,
          modelCount: modelIds.length,
          hasHfToken: !!hfToken,
          templateId: selectedTemplate?.id,
          bucketId: selectedBucketId ?? undefined,
          envVarCount: envVarCount ?? Object.keys(templateEnvValues).length,
          isEditMode,
          branch,
        });
        router.push({
          pathname: `/inference/services/${encodeURIComponent(params.templateId ?? '')}/payment`,
          query: { ...router.query, ...buildSelectionQuery() },
        });
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
        captureError('inference_config_failed', new Error('models_still_loading'), {
          stage: 'models_loading',
          model_count: modelIds.length,
          branch,
        });
        return;
      }
      const results = await Promise.all(modelIds.map((id) => paramRefs.current[id]!.validateAndGet()));
      // A null result here means a card failed its own validation and already highlighted its fields.
      if (results.some((params) => !params)) {
        setSubmitError('Fix the highlighted parameters before continuing.');
        captureError('inference_config_failed', new Error('model_params_invalid'), {
          stage: 'model_params_invalid',
          model_count: modelIds.length,
          branch,
        });
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
    if (isTemplateFlow) {
      // Validate each configurable env var against its regex. Empty is allowed unless the template
      // marks the var `required` — those are the ones the app can't start usefully without.
      const errors: Record<string, string> = {};
      for (const spec of envSpecs) {
        const value = (envInputs[spec.key] ?? '').trim();
        if (spec.required && !value) {
          errors[spec.key] = `${spec.key} is required for this template.`;
        } else if (!validateEnvValue(spec, value)) {
          errors[spec.key] = `Invalid ${spec.key} format.`;
        }
      }
      if (Object.keys(errors).length > 0) {
        setEnvErrors(errors);
        setSubmitError('Fix the highlighted fields before continuing.');
        captureError('inference_config_failed', new Error('template_env_invalid'), {
          stage: 'template_env_invalid',
          model_count: modelIds.length,
          template_id: selectedTemplate?.id,
          invalid_keys: Object.keys(errors),
          branch,
        });
        return;
      }
      // Commit only non-empty values — an empty optional field must not overwrite a fixed var or ship
      // an empty string to the container.
      const committed = Object.fromEntries(
        envSpecs.map((spec) => [spec.key, (envInputs[spec.key] ?? '').trim()]).filter(([, value]) => value)
      );
      setTemplateEnvValues(committed);
      goToNextStep(undefined, Object.keys(committed).length);
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
        contentBetween={
          <InferenceStepper
            currentStep="config"
            edit={isEditMode}
            flowType={flowType}
            template={selectedTemplate}
            showTemplateConfig={needsBucketPicker}
          />
        }
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
              <div>
                <h3>{selectedTemplate?.name ?? 'Template'} — settings</h3>
                <div className="textSecondary">
                  {isEditMode
                    ? 'Update the settings and relaunch. The container restarts on the same environment with the same paid session — the endpoint URL is unchanged.'
                    : 'Optional settings for this app.'}
                </div>
              </div>
              {/* Edit restarts the same container (serviceRestart has no outputBucketId, keeps whatever
                  bucket is already mounted) — nothing to pick here, so skip the picker. */}
              {selectedEnv && showsPicker && (
                <TemplateBucketPicker
                  nodeInfo={selectedEnv.nodeInfo}
                  onSelect={setSelectedBucketId}
                  selectedBucketId={selectedBucketId}
                />
              )}
              {isEditMode && needsBucketPicker && (
                <div className="textSecondary">The original persistent-storage bucket stays mounted.</div>
              )}
              {envSpecs.length > 0 ? (
                envSpecs.map((spec) => (
                  <Input
                    errorText={envErrors[spec.key]}
                    key={spec.key}
                    label={spec.required ? `${spec.key} (required)` : spec.key}
                    name={spec.key}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEnvInputs((prev) => ({ ...prev, [spec.key]: value }));
                      setEnvErrors((prev) => {
                        if (!prev[spec.key]) {
                          return prev;
                        }
                        const { [spec.key]: _removed, ...rest } = prev;
                        return rest;
                      });
                    }}
                    placeholder={spec.sensitive ? '••••••••' : ''}
                    size="md"
                    type={spec.sensitive ? 'password' : 'text'}
                    value={envInputs[spec.key] ?? ''}
                  />
                ))
              ) : !showsPicker ? (
                <div className="textSecondary">
                  This template has no configurable settings.
                  {isEditMode ? ' Relaunching restarts the container fresh.' : ''}
                </div>
              ) : null}
              {isEditMode && (
                <div className="textSecondary">
                  Secrets you entered on the original launch aren&apos;t stored — re-enter any tokens you need.
                </div>
              )}
              {/* A relaunch recreates the container from the image, and service containers get no
                  volume — so a bundle re-downloads everything it ships with, on the session the user
                  has already paid for. Say the cost before they commit to it. */}
              {isEditMode && selectedTemplate && isBundle(selectedTemplate) && bundleReloadNote && (
                <div className="textAccent1">{bundleReloadNote}</div>
              )}
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
