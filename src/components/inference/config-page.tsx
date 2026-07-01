import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import ModelParameters, { ModelParametersHandle } from '@/components/inference/model-parameters';
import Input from '@/components/input/input';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { decodeModelIds, encodeModelIds } from '@/services/huggingface-service';
import { InferenceFlowType } from '@/types/inference';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useMemo, useRef } from 'react';

const ConfigPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const params = useParams<{ modelId?: string; templateId?: string }>();
  const router = useRouter();
  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel;
  const modelIds = useMemo(() => decodeModelIds(router.query.models), [router.query.models]);
  const modelsQuery = encodeModelIds(modelIds);
  const { hfToken, setHfToken, setParamsForModel } = useInferenceContext();
  const paramRefs = useRef<Record<string, ModelParametersHandle | null>>({});

  const goToPrevStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.replace(`/inference/custom-models/resources?models=${modelsQuery}`);
        break;
      }
      case InferenceFlowType.Template: {
        router.replace(`/inference/templates/${encodeURIComponent(params.templateId ?? '')}/resources`);
        break;
      }
    }
  };

  const goToNextStep = () => {
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.push(`/inference/custom-models/payment?models=${modelsQuery}`);
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
    if (isCustomModelFlow) {
      const results = await Promise.all(modelIds.map((id) => paramRefs.current[id]?.validateAndGet() ?? null));
      if (results.some((params) => !params)) {
        return;
      }
      modelIds.forEach((id, index) => setParamsForModel(id, results[index]!));
    }
    goToNextStep();
  };

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch a model on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="config" flowType={flowType} />}
      />
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
            {modelIds.map((id, index) => (
              <ModelParameters
                defaultOpen={true}
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

        <InferenceNavigation nextButtonHtmlType="submit" onPrev={goToPrevStep} showNext />
      </form>
    </Container>
  );
};

export default ConfigPage;
