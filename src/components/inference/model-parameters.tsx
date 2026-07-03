import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Slider from '@/components/slider/slider';
import Switch from '@/components/switch/switch';
import { useInferenceContext } from '@/context/inference-context';
import {
  buildModelDefaults,
  fetchHuggingFaceModelConfig,
  getModelShortName,
  HuggingFaceAuthError,
  isGenerativePipeline,
  mapQuantization,
  MODEL_PARAM_BOUNDS,
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
    <div className={styles.labelWithInfo}>
      {bold ? <strong className={styles.switchLabel}>{label}</strong> : label}
      <Tooltip title={tooltip}>
        <InfoOutlinedIcon className="textAccent1" fontSize="small" />
      </Tooltip>
    </div>
  );
}

function validateParams(v: ModelParametersType): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.servedModelName.trim()) {
    errors.servedModelName = 'Required.';
  }
  const b = MODEL_PARAM_BOUNDS;
  if (v.maxContext < b.maxContext.min || v.maxContext > b.maxContext.max) {
    errors.maxContext = `Must be between ${b.maxContext.min} and ${b.maxContext.max}.`;
  }
  // GPU memory must be > 0 (0 = no VRAM claimed); message says "above 0" to match the rule.
  if (v.gpuMemoryUtilization <= 0 || v.gpuMemoryUtilization > b.gpuMemoryUtilization.max) {
    errors.gpuMemoryUtilization = `Must be above 0 and at most ${b.gpuMemoryUtilization.max}.`;
  }
  if (v.temperature < b.temperature.min || v.temperature > b.temperature.max) {
    errors.temperature = `Must be between ${b.temperature.min} and ${b.temperature.max}.`;
  }
  if (v.topP < b.topP.min || v.topP > b.topP.max) {
    errors.topP = `Must be between ${b.topP.min} and ${b.topP.max}.`;
  }
  if (v.topK !== -1 && (v.topK < b.topK.min || v.topK > b.topK.max)) {
    errors.topK = `Must be -1 (off) or between ${b.topK.min} and ${b.topK.max}.`;
  }
  if (v.repetitionPenalty < b.repetitionPenalty.min || v.repetitionPenalty > b.repetitionPenalty.max) {
    errors.repetitionPenalty = `Must be between ${b.repetitionPenalty.min} and ${b.repetitionPenalty.max}.`;
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

  // HF model facts that lock fields the user cannot freely change. Never let the ceiling drop below
  // the min — a model reporting a tiny context (e.g. 512) would otherwise invert the slider range.
  const contextCeiling = useMemo(
    () =>
      Math.max(
        MODEL_PARAM_BOUNDS.maxContext.min,
        Math.min(config?.maxContext ?? MODEL_PARAM_BOUNDS.maxContext.max, MODEL_PARAM_BOUNDS.maxContext.max)
      ),
    [config?.maxContext]
  );
  const lockedQuant = useMemo(() => mapQuantization(config?.quantizationMethod ?? null), [config?.quantizationMethod]);

  // Tool calling only applies to generative chat pipelines whose template references tools.
  const pipelineTag = useMemo(
    () => selectedModels.find((m) => m.id === modelId)?.pipelineTag,
    [selectedModels, modelId]
  );
  const isGenerative = isGenerativePipeline(pipelineTag);
  const showTools = isGenerative && !!config?.supportsTools;

  // Prefill from previously committed/restored context params (returning to the step or after a
  // refresh rehydrates them); else HF-derived defaults. Keyed on this model's params specifically so
  // an unrelated model's commit doesn't reinitialize this card. Defaults are spread underneath so a
  // params object hydrated from an older URL that lacks newer fields is completed, not left partial.
  const committedParams = modelParamsByModel[modelId];
  const initialValues = useMemo(
    () =>
      committedParams
        ? { ...buildModelDefaults(config, modelId), ...committedParams }
        : buildModelDefaults(config, modelId),
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
          formik.resetForm({ values: { ...buildModelDefaults(result, modelId), revision } });
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
          {/* Generation defaults only apply to text-sampling models; hidden (and left at neutral
              defaults) for embeddings/etc. so we don't commit params the summary would then drop. */}
          {isGenerative && (
            <>
              {/* Model — generation defaults the model recommends; applied when a request omits them. */}
              <div className={styles.subsection}>
                <div className={styles.subsectionHead}>
                  <h4 className={styles.subsectionTitle}>Generation defaults</h4>
                  <span className={styles.subsectionHint}>
                    Used when a request doesn’t set its own — clients can still override per call.
                  </span>
                </div>
                <div className={styles.grid}>
                  <div className={styles.column}>
                    <Slider
                      hint="temperature"
                      label={labelWithInfo(
                        `Temperature - ${formik.values.temperature.toFixed(2)}`,
                        'How random the output is. 0 = deterministic (always the most likely token); higher = more varied and creative. Around 0.7 suits chat; near 0 suits extraction/code. Seeded from the model’s own recommendation when it ships one.'
                      )}
                      max={MODEL_PARAM_BOUNDS.temperature.max}
                      min={MODEL_PARAM_BOUNDS.temperature.min}
                      name="temperature"
                      onChange={(_, value) => formik.setFieldValue('temperature', value)}
                      step={0.05}
                      topRight={`${MODEL_PARAM_BOUNDS.temperature.min} - ${MODEL_PARAM_BOUNDS.temperature.max}`}
                      value={formik.values.temperature}
                      valueLabelFormat={(value) => Number(value).toFixed(2)}
                    />
                    <Slider
                      hint="top_p"
                      label={labelWithInfo(
                        `Top P - ${formik.values.topP.toFixed(2)}`,
                        'Nucleus sampling: consider only the most likely tokens whose probabilities add up to this fraction. 1.0 = consider all; lower trims the unlikely tail for tighter output. Usually leave at 1.0 and steer with temperature instead.'
                      )}
                      max={MODEL_PARAM_BOUNDS.topP.max}
                      min={MODEL_PARAM_BOUNDS.topP.min}
                      name="topP"
                      onChange={(_, value) => formik.setFieldValue('topP', value)}
                      step={0.01}
                      topRight={`${MODEL_PARAM_BOUNDS.topP.min} - ${MODEL_PARAM_BOUNDS.topP.max}`}
                      value={formik.values.topP}
                      valueLabelFormat={(value) => Number(value).toFixed(2)}
                    />
                  </div>
                  <div className={styles.column}>
                    <Input
                      size="sm"
                      errorText={errorFor('topK')}
                      hint="top_k"
                      label={labelWithInfo(
                        'Top K',
                        'Consider only the K most likely tokens at each step. -1 disables it (no cap). A hard cousin of Top P — a fixed count rather than a probability mass. -1 is the common default.'
                      )}
                      name="topK"
                      onBlur={formik.handleBlur}
                      onChange={(e) => {
                        const next = e.target.value;
                        // Keep the field numeric; empty input falls back to -1 (off).
                        formik.setFieldValue('topK', next === '' ? -1 : Number(next));
                      }}
                      placeholder="-1"
                      type="number"
                      value={formik.values.topK}
                    />
                    <Slider
                      hint="repetition_penalty"
                      label={labelWithInfo(
                        `Repetition penalty - ${formik.values.repetitionPenalty.toFixed(2)}`,
                        'Discourages repeating tokens already generated. 1.0 = no penalty; above 1.0 pushes the model to vary its wording. Nudge up slightly if a model loops or repeats itself.'
                      )}
                      max={MODEL_PARAM_BOUNDS.repetitionPenalty.max}
                      min={MODEL_PARAM_BOUNDS.repetitionPenalty.min}
                      name="repetitionPenalty"
                      onChange={(_, value) => formik.setFieldValue('repetitionPenalty', value)}
                      step={0.01}
                      topRight={`${MODEL_PARAM_BOUNDS.repetitionPenalty.min} - ${MODEL_PARAM_BOUNDS.repetitionPenalty.max}`}
                      value={formik.values.repetitionPenalty}
                      valueLabelFormat={(value) => Number(value).toFixed(2)}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.divider} />
            </>
          )}

          {/* vLLM engine — cold launch flags: how the server loads and runs the model. */}
          <div className={styles.subsection}>
            <div className={styles.subsectionHead}>
              <h4 className={styles.subsectionTitle}>vLLM Launch flags</h4>
              <span className={styles.subsectionHint}>
                Fixed when the model starts — changing them requires a restart.
              </span>
            </div>
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
                  min={MODEL_PARAM_BOUNDS.maxContext.min}
                  name="maxContext"
                  onChange={(_, value) => formik.setFieldValue('maxContext', value)}
                  step={1024}
                  topRight={`${MODEL_PARAM_BOUNDS.maxContext.min} - ${contextCeiling}`}
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
                  max={MODEL_PARAM_BOUNDS.gpuMemoryUtilization.max}
                  min={MODEL_PARAM_BOUNDS.gpuMemoryUtilization.min}
                  name="gpuMemoryUtilization"
                  onChange={(_, value) => formik.setFieldValue('gpuMemoryUtilization', value)}
                  step={0.05}
                  topRight={`${MODEL_PARAM_BOUNDS.gpuMemoryUtilization.min} - ${MODEL_PARAM_BOUNDS.gpuMemoryUtilization.max}`}
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
          </div>
        </section>
      </Collapse>
    </Card>
  );
});

export default ModelParameters;
