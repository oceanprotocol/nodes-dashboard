import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Slider from '@/components/slider/slider';
import Switch from '@/components/switch/switch';
import { useInferenceContext } from '@/context/inference-context';
import {
  fetchHuggingFaceModelConfig,
  getModelShortName,
  HuggingFaceAuthError,
  inferToolCallParser,
} from '@/services/huggingface-service';
import {
  HuggingFaceModelConfig,
  KvCacheDtype,
  ModelDtype,
  ModelParameters as ModelParametersType,
  ModelQuantization,
  ToolCallParser,
} from '@/types/huggingface';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress, Collapse, Tooltip } from '@mui/material';
import cx from 'classnames';
import { useFormik } from 'formik';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import styles from './model-parameters.module.css';

const DEFAULT_MAX_CONTEXT = 32768;
const MIN_CONTEXT = 1024;
const CONTEXT_CEILING = 131072;
const DEFAULT_GPU_MEMORY_UTILIZATION = 0.9;

// Generative chat pipelines — the only ones where tool calling is meaningful.
const GENERATIVE_PIPELINE_TAGS = ['text-generation', 'text2text-generation', 'image-text-to-text'];

const quantizationOptions: { label: string; value: ModelQuantization }[] = [
  { label: 'None (bf16)', value: 'none' },
  { label: 'FP8', value: 'fp8' },
  { label: 'AWQ', value: 'awq' },
  { label: 'GPTQ', value: 'gptq' },
];

const dtypeOptions: { label: string; value: ModelDtype }[] = [
  { label: 'auto', value: 'auto' },
  { label: 'bfloat16', value: 'bfloat16' },
  { label: 'float16', value: 'float16' },
  { label: 'float32', value: 'float32' },
];

const kvCacheDtypeOptions: { label: string; value: KvCacheDtype }[] = [
  { label: 'auto', value: 'auto' },
  { label: 'fp8', value: 'fp8' },
];

const toolParserOptions: { label: string; value: ToolCallParser }[] = [
  { label: 'hermes', value: 'hermes' },
  { label: 'llama3_json', value: 'llama3_json' },
  { label: 'llama4_json', value: 'llama4_json' },
  { label: 'mistral', value: 'mistral' },
  { label: 'granite', value: 'granite' },
  { label: 'granite-20b-fc', value: 'granite-20b-fc' },
  { label: 'internlm', value: 'internlm' },
  { label: 'jamba', value: 'jamba' },
  { label: 'deepseek_v3', value: 'deepseek_v3' },
  { label: 'pythonic', value: 'pythonic' },
];

/** Field label with an info-icon tooltip describing what the flag does. */
function labelWithInfo(label: string, tooltip: string, bold = false): React.ReactNode {
  return (
    <div>
      {bold ? <strong className={styles.switchLabel}>{label}</strong> : label}{' '}
      <Tooltip title={tooltip}>
        <InfoOutlinedIcon className="textAccent1" fontSize="small" />
      </Tooltip>
    </div>
  );
}

function mapTorchDtype(torchDtype: string | null): ModelDtype {
  switch (torchDtype) {
    case 'bfloat16': {
      return 'bfloat16';
    }
    case 'float16': {
      return 'float16';
    }
    case 'float32': {
      return 'float32';
    }
    default: {
      return 'auto';
    }
  }
}

function mapQuantization(method: string | null): ModelQuantization | null {
  switch (method?.toLowerCase()) {
    case 'fp8': {
      return 'fp8';
    }
    case 'awq': {
      return 'awq';
    }
    case 'gptq': {
      return 'gptq';
    }
    default: {
      return null;
    }
  }
}

function buildDefaults(config: HuggingFaceModelConfig | null, modelId: string): ModelParametersType {
  const lockedQuant = mapQuantization(config?.quantizationMethod ?? null);
  return {
    servedModelName: getModelShortName(modelId),
    maxContext: Math.min(config?.maxContext ?? DEFAULT_MAX_CONTEXT, CONTEXT_CEILING),
    gpuMemoryUtilization: DEFAULT_GPU_MEMORY_UTILIZATION,
    quantization: lockedQuant ?? 'none',
    dtype: mapTorchDtype(config?.torchDtype ?? null),
    kvCacheDtype: 'auto',
    trustRemoteCode: false,
    enforceEager: false,
    revision: '',
    toolCalling: false,
    // Pre-fill the best-guess parser (still user-overridable); null when the family is unknown.
    toolCallParser: inferToolCallParser(config),
  };
}

function validateParams(v: ModelParametersType): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.servedModelName.trim()) {
    errors.servedModelName = 'Required.';
  }
  if (v.maxContext < MIN_CONTEXT || v.maxContext > CONTEXT_CEILING) {
    errors.maxContext = `Must be between ${MIN_CONTEXT} and ${CONTEXT_CEILING}.`;
  }
  if (v.gpuMemoryUtilization <= 0 || v.gpuMemoryUtilization > 1) {
    errors.gpuMemoryUtilization = 'Must be between 0 and 1.';
  }
  if (v.toolCalling && !v.toolCallParser) {
    errors.toolCallParser = 'Pick a parser — tool calling breaks at runtime without one.';
  }
  return errors;
}

type ModelParametersProps = {
  modelId: string;
  defaultOpen?: boolean;
};

/** Imperative handle for parent-driven actions on a model card. */
export type ModelParametersHandle = {
  /** Validate the card's form and return its params, or null when invalid. */
  validateAndGet: () => Promise<ModelParametersType | null>;
  /** Re-fetch HF defaults and reset the form to them (e.g. after the shared token changes). */
  reloadDefaults: () => void;
};

const ModelParameters = forwardRef<ModelParametersHandle, ModelParametersProps>(function ModelParameters(
  { modelId, defaultOpen = false },
  ref
) {
  const { hfToken, selectedModels, modelParamsByModel } = useInferenceContext();
  const [config, setConfig] = useState<HuggingFaceModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  // 'none' = no token needed / loaded ok; 'missing' = gated, no token supplied; 'rejected' = token invalid.
  const [authState, setAuthState] = useState<'none' | 'missing' | 'rejected'>('none');
  const [loadError, setLoadError] = useState<string | null>(null);
  // Feedback for the explicit "Reload defaults" action (initial load stays silent beyond the spinner).
  const [reloadStatus, setReloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [open, setOpen] = useState(defaultOpen);

  const loadConfig = useCallback(
    (
      token?: string,
      revision?: string,
      onLoaded?: (config: HuggingFaceModelConfig | null) => void,
      isReload = false
    ) => {
      let cancelled = false;
      setLoading(true);
      setLoadError(null);
      if (isReload) {
        setReloadStatus('loading');
      }
      fetchHuggingFaceModelConfig(modelId, token || undefined, revision || undefined)
        .then((result) => {
          if (cancelled) {
            return;
          }
          setConfig(result);
          setAuthState('none');
          setReloadStatus(isReload ? 'success' : 'idle');
          onLoaded?.(result);
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          if (error instanceof HuggingFaceAuthError) {
            // Gated/private model — distinguish "no token yet" from "token supplied but rejected".
            setAuthState(error.tokenProvided ? 'rejected' : 'missing');
            setReloadStatus(isReload ? 'error' : 'idle');
          } else {
            setConfig(null);
            setLoadError('Could not load model defaults from Hugging Face. Using generic defaults.');
            setReloadStatus(isReload ? 'error' : 'idle');
            onLoaded?.(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    },
    [modelId]
  );

  // Initial load only. Token/revision changes reload via the explicit "Reload defaults" button.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => loadConfig(hfToken), [loadConfig]);

  // Editing the shared token invalidates the last reload result — clear the transient feedback so a
  // stale "reloaded"/"rejected" notice doesn't linger until the user clicks Reload again.
  useEffect(() => {
    setReloadStatus('idle');
  }, [hfToken]);

  // HF model facts that lock fields the user cannot freely change.
  const contextCeiling = useMemo(
    () => Math.min(config?.maxContext ?? CONTEXT_CEILING, CONTEXT_CEILING),
    [config?.maxContext]
  );
  const lockedQuant = useMemo(() => mapQuantization(config?.quantizationMethod ?? null), [config?.quantizationMethod]);

  // Tool calling only applies to generative chat pipelines whose template references tools.
  const pipelineTag = useMemo(
    () => selectedModels.find((m) => m.id === modelId)?.pipelineTag,
    [selectedModels, modelId]
  );
  const isGenerative = !pipelineTag || GENERATIVE_PIPELINE_TAGS.includes(pipelineTag);
  const showTools = isGenerative && !!config?.supportsTools;

  // Prefill from previously committed/restored context params (returning to the step or after a
  // refresh rehydrates them); else HF-derived defaults. Keyed on this model's params specifically so
  // an unrelated model's commit doesn't reinitialize this card.
  const committedParams = modelParamsByModel[modelId];
  const initialValues = useMemo(
    () => committedParams ?? buildDefaults(config, modelId),
    [committedParams, config, modelId]
  );

  const formik = useFormik<ModelParametersType>({
    enableReinitialize: true,
    initialValues,
    validate: validateParams,
    onSubmit: () => {},
  });

  // Show a field error only once the user has touched it.
  const errorFor = (field: keyof ModelParametersType) =>
    formik.touched[field] ? (formik.errors[field] as string | undefined) : undefined;

  // Re-fetch HF defaults for the current token + pinned revision, then reset the form to them.
  // The entered revision is preserved — buildDefaults blanks it, but it's what we just fetched against.
  const reloadDefaults = () => {
    const revision = formik.values.revision;
    loadConfig(
      hfToken,
      revision,
      (result) => {
        // Only reset the form when defaults actually loaded; on failure keep the user's values.
        if (result) {
          formik.resetForm({ values: { ...buildDefaults(result, modelId), revision } });
        }
      },
      true
    );
  };

  // Pinning a new revision refreshes the model facts (locked ceiling/quant) without touching the user's edits.
  const handleRevisionBlur = () => {
    loadConfig(hfToken, formik.values.revision);
  };

  // Validate on demand (parent submit); return values only when the form is clean, open the card on error.
  useImperativeHandle(
    ref,
    () => ({
      validateAndGet: async () => {
        const errors = await formik.validateForm();
        if (Object.keys(errors).length > 0) {
          formik.setTouched(
            Object.keys(errors).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
            false
          );
          setOpen(true);
          return null;
        }
        return formik.values;
      },
      reloadDefaults,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formik]
  );

  // Unset tool params for a model that doesn't support them.
  useEffect(() => {
    if (!showTools && (formik.values.toolCalling || formik.values.toolCallParser)) {
      formik.setValues({ ...formik.values, toolCalling: false, toolCallParser: null });
    }
  }, [showTools, formik]);

  // Full-card spinner only on the first load; later reloads (e.g. after a token) keep the form visible.
  if (loading && !config && authState === 'none' && !loadError) {
    return (
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <h3 className={styles.loading}>
          <CircularProgress size={24} />
          Loading model defaults from Hugging Face…
        </h3>
      </Card>
    );
  }

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="lg" variant="glass-shaded">
      <div>
        <button aria-expanded={open} className={styles.head} onClick={() => setOpen(!open)} type="button">
          <span className={styles.headName}>{getModelShortName(modelId)}</span>
          <ExpandMoreIcon className={cx(styles.chevron, { [styles.chevronOpen]: open })} />
        </button>
        {reloadStatus === 'loading' ? (
          <div className={cx(styles.notice, styles.noticeRow)}>
            <CircularProgress size={16} />
            Reloading defaults from Hugging Face…
          </div>
        ) : authState === 'missing' ? (
          <div className={cx(styles.notice, styles.noticeWarning)}>
            This model is gated or private. Add your Hugging Face token above and click “Reload defaults”.
          </div>
        ) : authState === 'rejected' ? (
          <div className={cx(styles.notice, styles.noticeWarning)}>
            The Hugging Face token was rejected for this model — invalid or lacks access. Check the token and reload.
          </div>
        ) : loadError ? (
          <div className={cx(styles.notice, styles.noticeWarning)}>{loadError}</div>
        ) : reloadStatus === 'success' ? (
          <div className={cx(styles.notice, styles.noticeSuccess)}>Defaults reloaded from Hugging Face.</div>
        ) : null}
      </div>
      <Collapse in={open} unmountOnExit>
        <section className={styles.section}>
          <div className={styles.grid}>
            <div className={styles.column}>
              <Input
                size="sm"
                errorText={errorFor('servedModelName')}
                hint="--served-model-name"
                label={labelWithInfo(
                  'Served model name',
                  'The name the running model answers to — clients put this in the request `model` field and it shows in the model dropdown. A routing label only; if wrong, clients can’t address the model.'
                )}
                name="servedModelName"
                onBlur={formik.handleBlur}
                onChange={formik.handleChange}
                placeholder="model"
                type="text"
                value={formik.values.servedModelName}
              />
              <Slider
                hint="--max-model-len"
                label={labelWithInfo(
                  `Max context - ${formik.values.maxContext}`,
                  'Max tokens (input + output combined) per request. Clients can’t exceed it. Higher handles longer documents but uses more VRAM for the KV cache. Ceiling comes from the model’s own config.'
                )}
                max={contextCeiling}
                min={MIN_CONTEXT}
                name="maxContext"
                onChange={(_, value) => formik.setFieldValue('maxContext', value)}
                step={1024}
                topRight={`${MIN_CONTEXT} - ${contextCeiling}`}
                value={formik.values.maxContext}
                valueLabelFormat={(value) => String(value)}
              />
              <Select<ModelQuantization>
                size="sm"
                disabled={!!lockedQuant}
                hint={lockedQuant ? 'Locked by model — already quantized' : '--quantization'}
                label={labelWithInfo(
                  'Quantization',
                  'Compress model weights to a smaller numeric format to save VRAM. none = full precision (bf16); fp8/awq/gptq = smaller, often faster, slight quality tradeoff. Locked when the model ships pre-quantized. FP8 needs H100+ hardware.'
                )}
                name="quantization"
                onChange={formik.handleChange}
                options={quantizationOptions}
                value={formik.values.quantization}
              />
              <Select<ModelDtype>
                size="sm"
                hint="--dtype"
                label={labelWithInfo(
                  'dtype',
                  'Numeric precision for the model’s math when not quantized. bfloat16/float16 = half precision (standard, fast); float32 = full (2× memory, rarely needed); auto = let vLLM pick from config. bf16 is the normal choice.'
                )}
                name="dtype"
                onChange={formik.handleChange}
                options={dtypeOptions}
                value={formik.values.dtype}
              />
              <div>
                <Switch
                  checked={formik.values.trustRemoteCode}
                  label={labelWithInfo(
                    'Trust remote code',
                    'Allows the model to run custom Python shipped in its HF repo (custom architectures/tokenizers). Many vision/OCR models won’t load without it. Off by default because it executes repo-authored code.',
                    true
                  )}
                  name="trustRemoteCode"
                  onChange={(_, checked) => formik.setFieldValue('trustRemoteCode', checked)}
                />
                <div className="textSecondary">--trust-remote-code</div>
              </div>
            </div>

            <div className={styles.column}>
              {showTools && (
                <>
                  <div>
                    <Switch
                      checked={formik.values.toolCalling}
                      label={labelWithInfo(
                        'Tool calling',
                        'Enables function/tool calling so the model can emit structured tool-call requests (what OpenWebUI’s function-calling needs). Cold — must be set at launch, can’t be toggled per request. Only shown for models whose chat template supports tools.',
                        true
                      )}
                      name="toolCalling"
                      onChange={(_, checked) => {
                        formik.setFieldValue('toolCalling', checked);
                        if (!checked) {
                          formik.setFieldValue('toolCallParser', null);
                        }
                      }}
                    />
                    <div className="textSecondary">--enable-auto-tool-choice</div>
                  </div>
                  {formik.values.toolCalling && (
                    <Select<ToolCallParser | ''>
                      size="sm"
                      errorText={formik.errors.toolCallParser}
                      hint="--tool-call-parser"
                      label={labelWithInfo(
                        'Tool call parser',
                        'Tells vLLM how to parse the tool calls this model family emits (each formats them differently — llama, mistral, hermes, deepseek…). Must match the model or tool calls break. Auto-inferred from family, overridable, required when tool calling is on.'
                      )}
                      name="toolCallParser"
                      onChange={(e) =>
                        formik.setFieldValue('toolCallParser', (e.target.value as ToolCallParser) || null)
                      }
                      options={toolParserOptions}
                      placeholder="Select parser"
                      value={formik.values.toolCallParser ?? ''}
                    />
                  )}
                </>
              )}
              <Slider
                hint="--gpu-memory-utilization"
                label={labelWithInfo(
                  `GPU memory utilization - ${formik.values.gpuMemoryUtilization.toFixed(2)}`,
                  'Fraction of the GPU’s VRAM vLLM may claim (0–1). 0.9 = up to 90%, leaving headroom. Higher = more room for KV cache / bigger batches; too high risks OOM. The actual “how much VRAM” lever.'
                )}
                max={1}
                min={0}
                name="gpuMemoryUtilization"
                onChange={(_, value) => formik.setFieldValue('gpuMemoryUtilization', value)}
                step={0.05}
                topRight="0 - 1"
                value={formik.values.gpuMemoryUtilization}
                valueLabelFormat={(value) => Number(value).toFixed(2)}
              />
              <Select<KvCacheDtype>
                size="sm"
                hint="--kv-cache-dtype"
                label={labelWithInfo(
                  'KV cache dtype',
                  'Precision for the KV cache specifically (memory holding context during generation). auto matches the model dtype; fp8 shrinks the cache so you fit more/longer sequences in the same VRAM, tiny quality cost. Separate from weight quantization.'
                )}
                name="kvCacheDtype"
                onChange={formik.handleChange}
                options={kvCacheDtypeOptions}
                value={formik.values.kvCacheDtype}
              />
              <Input
                size="sm"
                hint="--revision"
                label={labelWithInfo(
                  'Revision',
                  'Which version of the HF repo to load — a branch, tag, or commit hash. Blank = main (latest). Pin an exact checkpoint so the model doesn’t silently change if the repo updates.'
                )}
                name="revision"
                onBlur={handleRevisionBlur}
                onChange={formik.handleChange}
                placeholder="main"
                type="text"
                value={formik.values.revision}
              />
              <div>
                <Switch
                  checked={formik.values.enforceEager}
                  label={labelWithInfo(
                    'Enforce eager',
                    'Disables CUDA graph capture, forcing eager execution. Slower, but uses less VRAM and is more forgiving — a fallback for debugging or when a model won’t start cleanly. Off = normal (faster) mode.',
                    true
                  )}
                  name="enforceEager"
                  onChange={(_, checked) => formik.setFieldValue('enforceEager', checked)}
                />
                <div className="textSecondary">--enforce-eager</div>
              </div>
            </div>
          </div>
        </section>
      </Collapse>
    </Card>
  );
});

export default ModelParameters;
