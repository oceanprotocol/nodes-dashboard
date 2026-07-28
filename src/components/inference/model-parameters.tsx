import Button from '@/components/button/button';
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
  INFERENCE_ENGINE_OPTIONS,
  isGenerativePipeline,
  mapQuantization,
  MODEL_PARAM_BOUNDS,
} from '@/services/huggingface-service';
import {
  HuggingFaceModelConfig,
  InferenceEngine,
  KvCacheDtype,
  LlamaCppParameters,
  ModelDtype,
  ModelParameters as ModelParametersType,
  ModelQuantization,
  ToolCallParser,
  VllmParameters,
} from '@/types/huggingface';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress, Collapse, Tooltip } from '@mui/material';
import cx from 'classnames';
import { useFormik } from 'formik';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
  { label: 'qwen3_coder', value: 'qwen3_coder' },
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

// Formik error shape: flat fields carry a string; customParams carries a per-row array (Formik
// renders `errors.customParams[i].key`). Typed loosely so both can coexist on one errors object.
type ParamErrors = Record<string, unknown>;

// Custom params (extra launch flags): the only rule is non-empty, unique keys. Values are free-form.
// Uniqueness is checked on the flag the key normalizes to, so `dtype` and `--dtype` collide — they'd
// otherwise emit the same flag twice. Shared by both engines. Writes onto the passed errors object.
function validateCustomParams(v: ModelParametersType, errors: ParamErrors): void {
  const seen = new Map<string, number>();
  const paramErrors: { key?: string }[] = [];
  v.customParams.forEach((param, index) => {
    const trimmed = param.key.trim().replace(/^-+/, '');
    if (!trimmed) {
      paramErrors[index] = { key: 'Key is required.' };
    } else if (seen.has(trimmed)) {
      paramErrors[index] = { key: 'Duplicate key.' };
    } else {
      seen.set(trimmed, index);
    }
  });
  if (paramErrors.some(Boolean)) {
    errors.customParams = paramErrors;
  }
}

// `contextCeiling` is the model's reported max (null when HF reports none → free optional input).
// `contextFloor` is the effective lower bound. Passed in because they're component state, not static.
function validateParams(
  v: ModelParametersType,
  contextCeiling: number | null,
  contextFloor: number,
  bookedGpus: number
): ParamErrors {
  const errors: ParamErrors = {};
  if (!v.servedModelName.trim()) {
    errors.servedModelName = 'Required.';
  }

  if (v.engine === 'llamacpp') {
    if (!v.ggufRepo.trim()) {
      errors.ggufRepo = 'Required — the GGUF repo llama.cpp pulls the model from.';
    }
    // Optional: blank/null lets llama.cpp use the model's trained context. A pinned value clears the floor.
    if (v.contextLength != null && v.contextLength < contextFloor) {
      errors.contextLength = `Must be at least ${contextFloor} (or leave blank to use the model default).`;
    }
    if (v.gpuLayers < 0) {
      errors.gpuLayers = 'Must be 0 or more (0 runs on CPU).';
    }
  } else {
    // Optional: blank/null lets vLLM derive the length. A pinned value must clear the floor and (when
    // the model reports a ceiling) stay within it.
    if (v.maxContext != null) {
      if (v.maxContext < contextFloor) {
        errors.maxContext = `Must be at least ${contextFloor} (or leave blank to let vLLM decide).`;
      } else if (contextCeiling != null && v.maxContext > contextCeiling) {
        errors.maxContext = `Must be at most ${contextCeiling} — the model's context limit.`;
      }
    }
    // GPU memory must stay within bounds — the floor is > 0 (0 = no VRAM claimed, rejected).
    const gpuMin = MODEL_PARAM_BOUNDS.gpuMemoryUtilization.min;
    const gpuMax = MODEL_PARAM_BOUNDS.gpuMemoryUtilization.max;
    if (v.gpuMemoryUtilization < gpuMin || v.gpuMemoryUtilization > gpuMax) {
      errors.gpuMemoryUtilization = `Must be between ${gpuMin} and ${gpuMax}.`;
    }
    // Sharding across more GPUs than were booked makes vLLM exit at startup, so the booked count is a
    // hard ceiling. null/1 = single GPU, always valid.
    if (v.tensorParallelSize != null) {
      if (v.tensorParallelSize < 1 || !Number.isInteger(v.tensorParallelSize)) {
        errors.tensorParallelSize = 'Must be a whole number of GPUs (1 or more).';
      } else if (v.tensorParallelSize > bookedGpus) {
        errors.tensorParallelSize = `Only ${bookedGpus} GPU${bookedGpus === 1 ? '' : 's'} booked — the model can't shard across more.`;
      }
    }
    if (v.toolCalling && !v.toolCallParser) {
      errors.toolCallParser = 'Pick a parser — tool calling breaks at runtime without one.';
    }
  }

  validateCustomParams(v, errors);
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
  const { hfToken, selectedModels, modelParamsByModel, engine, setEngine, selectedEnv } = useInferenceContext();

  // GPUs booked on the resources step (which runs before this one). This is the ceiling for tensor
  // parallelism — sharding across more GPUs than were booked makes vLLM exit at startup. 1 or fewer
  // means there's nothing to shard, so the field is hidden and the flag is never emitted.
  const bookedGpus = useMemo(
    () => Object.values(selectedEnv?.gpuSelection ?? {}).reduce((sum, count) => sum + count, 0),
    [selectedEnv?.gpuSelection]
  );
  // `config` = LATEST fetched facts (drives locked ceiling/quant + tool visibility). `defaultsConfig`
  // = baseline the form defaults build from — frozen except on first load and explicit "Reload
  // defaults", so a revision-blur refresh updates facts without reinitializing formik and wiping edits.
  const [config, setConfig] = useState<HuggingFaceModelConfig | null>(null);
  const [defaultsConfig, setDefaultsConfig] = useState<HuggingFaceModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  // 'none' = no token needed / loaded ok; 'missing' = gated, no token supplied; 'rejected' = token invalid.
  const [authState, setAuthState] = useState<'none' | 'missing' | 'rejected'>('none');
  const [loadError, setLoadError] = useState<string | null>(null);
  // Feedback for the explicit "Reload defaults" action (initial load stays silent beyond the spinner).
  const [reloadStatus, setReloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [open, setOpen] = useState(defaultOpen);
  // Guards the one-time initial load: loadConfig's identity changes with hfToken, so a [loadConfig]
  // dep can't fire it exactly once — this ref does.
  const initialLoadStartedRef = useRef(false);

  const loadConfig = useCallback(
    ({
      revision,
      onLoaded,
      isReload,
      resetDefaults,
    }: {
      revision?: string;
      onLoaded?: (config: HuggingFaceModelConfig | null) => void;
      isReload: boolean;
      // Also refresh the baseline the form defaults are built from. Set for the initial load and an
      // explicit reload; left false for a revision-blur refresh so the user's edits aren't reset.
      resetDefaults: boolean;
    }) => {
      let cancelled = false;
      setLoading(true);
      setLoadError(null);
      if (isReload) {
        setReloadStatus('loading');
      }
      fetchHuggingFaceModelConfig(modelId, hfToken, revision)
        .then((result) => {
          if (cancelled) {
            return;
          }
          setConfig(result);
          if (resetDefaults) {
            setDefaultsConfig(result);
          }
          setAuthState('none');
          setReloadStatus(isReload ? 'success' : 'idle');
          onLoaded?.(result);
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          if (error instanceof HuggingFaceAuthError) {
            // Gated/private — distinguish "no token yet" from "token supplied but rejected".
            setAuthState(error.tokenProvided ? 'rejected' : 'missing');
            setReloadStatus(isReload ? 'error' : 'idle');
          } else {
            setConfig(null);
            if (resetDefaults) {
              setDefaultsConfig(null);
            }
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
    [hfToken, modelId]
  );

  // Initial load only (ref-guarded so it never re-fires when loadConfig's identity changes on a token
  // edit). Reloads happen via the explicit "Reload defaults" button — typing the token must NOT
  // auto-refetch, which would reset the baseline and wipe uncommitted edits.
  useEffect(() => {
    if (initialLoadStartedRef.current) {
      return;
    }
    initialLoadStartedRef.current = true;
    return loadConfig({ isReload: false, resetDefaults: true });
  }, [loadConfig]);

  // Editing the token invalidates the last reload result — clear transient feedback so a stale
  // "reloaded"/"rejected" notice doesn't linger.
  useEffect(() => {
    setReloadStatus('idle');
  }, [hfToken]);

  // Model's own reported max context, used verbatim — NEVER raised above its real capability. null
  // when HF reports nothing: the field goes free/blank and launch omits --max-model-len (vLLM derives it).
  const contextCeiling = useMemo(() => config?.maxContext ?? null, [config?.maxContext]);

  // Effective lower bound for max-context. Normally the static floor, but a model whose reported max
  // is BELOW the floor lowers it to that max — so the range collapses to the single value the model
  // accepts (see MODEL_PARAM_BOUNDS). No ceiling → nominal floor applies to a pinned value.
  const contextFloor = useMemo(
    () =>
      contextCeiling != null
        ? Math.min(MODEL_PARAM_BOUNDS.maxContext.min, contextCeiling)
        : MODEL_PARAM_BOUNDS.maxContext.min,
    [contextCeiling]
  );
  const lockedQuant = useMemo(() => mapQuantization(config?.quantizationMethod ?? null), [config?.quantizationMethod]);

  // Tool calling only applies to generative chat pipelines whose template references tools.
  const pipelineTag = useMemo(
    () => selectedModels.find((m) => m.id === modelId)?.pipelineTag,
    [selectedModels, modelId]
  );
  const isGenerative = isGenerativePipeline(pipelineTag);
  const showTools = isGenerative && !!config?.supportsTools;

  // Prefill from committed/restored context params (else HF-derived defaults). Keyed on this model's
  // params so an unrelated model's commit doesn't reinitialize this card. Defaults spread underneath
  // so a params object from an older URL lacking newer fields is completed, not left partial. The
  // committed params are only merged when they match the SELECTED engine — switching engine drops the
  // old branch's fields and starts from that engine's fresh defaults (their shapes don't overlap).
  const committedParams = modelParamsByModel[modelId];
  const initialValues = useMemo(() => {
    const defaults = buildModelDefaults(defaultsConfig, modelId, engine);
    return committedParams && committedParams.engine === engine
      ? ({ ...defaults, ...committedParams } as ModelParametersType)
      : defaults;
  }, [committedParams, defaultsConfig, modelId, engine]);

  const formik = useFormik<ModelParametersType>({
    enableReinitialize: true,
    initialValues,
    validate: (v) => validateParams(v, contextCeiling, contextFloor, bookedGpus),
    onSubmit: () => {},
  });

  // Show a field error only once the user has touched it. Typed loosely (string) because the field
  // set differs per engine branch — the form values are a discriminated union.
  const errorFor = (field: string) =>
    (formik.touched as Record<string, unknown>)[field]
      ? ((formik.errors as Record<string, unknown>)[field] as string | undefined)
      : undefined;

  // Per-row custom-param key error (Formik nests these as errors.customParams[i].key).
  const customParamKeyError = (index: number): string | undefined => {
    const rowErrors = formik.errors.customParams as { key?: string }[] | undefined;
    const rowTouched = (formik.touched.customParams as { key?: boolean }[] | undefined)?.[index];
    return rowTouched?.key ? rowErrors?.[index]?.key : undefined;
  };

  const addCustomParam = () => {
    formik.setFieldValue('customParams', [...formik.values.customParams, { key: '', value: '' }]);
  };

  const removeCustomParam = (index: number) => {
    formik.setFieldValue(
      'customParams',
      formik.values.customParams.filter((_, i) => i !== index)
    );
  };

  // Re-fetch HF defaults for the current token + pinned revision, then reset the form to them. The
  // entered revision (vLLM only) is preserved — buildDefaults blanks it, but it's what we just
  // fetched against. Rebuilds defaults for the ACTIVE engine so a reload keeps the right branch.
  const reloadDefaults = () => {
    const revision = formik.values.engine === 'vllm' ? formik.values.revision : undefined;
    loadConfig({
      revision,
      onLoaded: (result) => {
        // Only reset the form when defaults actually loaded; on failure keep the user's values.
        if (result) {
          const defaults = buildModelDefaults(result, modelId, formik.values.engine);
          // `revision` is only set for vLLM, so `defaults` is the vLLM branch here — but TS can't
          // correlate the two, so re-assert the union type on the merged values.
          const values = (revision ? { ...defaults, revision } : defaults) as ModelParametersType;
          formik.resetForm({ values });
        }
      },
      isReload: true,
      resetDefaults: true,
    });
  };

  // Pinning a new revision refreshes model facts (locked ceiling/quant) without touching edits —
  // resetDefaults=false keeps the form baseline frozen so formik doesn't reinitialize. vLLM only
  // (llama.cpp serves a GGUF by repo:quant and has no revision field).
  const handleRevisionBlur = () => {
    loadConfig({
      revision: formik.values.engine === 'vllm' ? formik.values.revision : undefined,
      isReload: false,
      resetDefaults: false,
    });
  };

  // Validate on demand (parent submit); return values only when the form is clean, open the card on error.
  useImperativeHandle(
    ref,
    () => ({
      validateAndGet: async () => {
        const errors = await formik.validateForm();
        if (Object.keys(errors).length > 0) {
          // Mark every errored field touched so its message shows. customParams errors are a per-row
          // array — mirror that shape so Formik surfaces each row's key error.
          const touched = Object.keys(errors).reduce<Record<string, unknown>>((acc, key) => {
            if (key === 'customParams' && Array.isArray(errors.customParams)) {
              acc.customParams = (errors.customParams as unknown[]).map((rowError) => (rowError ? { key: true } : {}));
            } else {
              acc[key] = true;
            }
            return acc;
          }, {});
          formik.setTouched(touched, false);
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

  // Unset vLLM tool params for a model that doesn't support them (llama.cpp has no tool-parser field).
  useEffect(() => {
    if (formik.values.engine !== 'vllm') {
      return;
    }
    if (!showTools && (formik.values.toolCalling || formik.values.toolCallParser)) {
      formik.setValues({ ...formik.values, toolCalling: false, toolCallParser: null });
    }
  }, [showTools, formik]);

  // Going back and re-booking fewer GPUs would otherwise leave a now-impossible shard width behind
  // (the field hides below 2 GPUs, so the user couldn't even see the stale value to fix it).
  useEffect(() => {
    if (formik.values.engine !== 'vllm' || formik.values.tensorParallelSize == null) {
      return;
    }
    if (formik.values.tensorParallelSize > bookedGpus) {
      formik.setFieldValue('tensorParallelSize', bookedGpus > 1 ? bookedGpus : null);
    }
  }, [bookedGpus, formik]);

  // vLLM cold launch flags — how the server loads and runs the raw HF weights. `v` is the narrowed
  // vLLM branch of the form values (writes still go through formik by field name).
  const renderVllmFlags = (v: VllmParameters) => (
    <div className={styles.subsection}>
      <div>
        <h4>vLLM launch flags</h4>
        <div className="textSecondary">Fixed when the model starts — changing them requires a restart</div>
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
            value={v.servedModelName}
          />
          {contextCeiling != null ? (
            <Slider
              errorText={errorFor('maxContext')}
              hint="--max-model-len"
              label={labelWithInfo(
                `Max context - ${v.maxContext ?? contextCeiling}`,
                'Max tokens (input + output combined) per request. Clients can’t exceed it. Higher handles longer documents but uses more VRAM for the KV cache. Ceiling comes from the model’s own config.'
              )}
              max={contextCeiling}
              min={contextFloor}
              name="maxContext"
              onChange={(_, value) => formik.setFieldValue('maxContext', value)}
              step={1024}
              topRight={`${contextFloor} - ${contextCeiling}`}
              value={v.maxContext ?? contextCeiling}
              valueLabelFormat={(value) => String(value)}
            />
          ) : (
            // Hugging Face reported no context length — offer a free, optional input. Blank means
            // vLLM derives the length from the model config at launch (--max-model-len omitted).
            <Input
              size="sm"
              errorText={errorFor('maxContext')}
              hint="--max-model-len"
              label={labelWithInfo(
                'Max context',
                'Max tokens (input + output combined) per request. Leave blank to let vLLM derive it from the model’s own config; set a number to pin it explicitly.'
              )}
              name="maxContext"
              onBlur={formik.handleBlur}
              onChange={(e) => {
                const raw = e.target.value.trim();
                formik.setFieldValue('maxContext', raw === '' ? null : Number(raw));
              }}
              placeholder="Auto (vLLM decides)"
              type="number"
              value={v.maxContext ?? ''}
            />
          )}
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
            value={v.quantization}
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
            value={v.dtype}
          />
          <div>
            <Switch
              checked={v.trustRemoteCode}
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
                  checked={v.toolCalling}
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
              {v.toolCalling && (
                <Select<ToolCallParser | ''>
                  size="sm"
                  errorText={(formik.errors as Record<string, unknown>).toolCallParser as string | undefined}
                  hint="--tool-call-parser"
                  label={labelWithInfo(
                    'Tool call parser',
                    'Tells vLLM how to parse the tool calls this model family emits (each formats them differently — llama, mistral, hermes, deepseek…). Must match the model or tool calls break. Auto-inferred from family, overridable, required when tool calling is on.'
                  )}
                  name="toolCallParser"
                  onChange={(e) => formik.setFieldValue('toolCallParser', (e.target.value as ToolCallParser) || null)}
                  options={toolParserOptions}
                  placeholder="Select parser"
                  value={v.toolCallParser ?? ''}
                />
              )}
            </>
          )}
          <Slider
            errorText={errorFor('gpuMemoryUtilization')}
            hint="--gpu-memory-utilization"
            label={labelWithInfo(
              `GPU memory utilization - ${v.gpuMemoryUtilization.toFixed(2)}`,
              'Fraction of the GPU’s VRAM vLLM may claim (0–1). 0.9 = up to 90%, leaving headroom. Higher = more room for KV cache / bigger batches; too high risks OOM. The actual “how much VRAM” lever.'
            )}
            max={MODEL_PARAM_BOUNDS.gpuMemoryUtilization.max}
            min={MODEL_PARAM_BOUNDS.gpuMemoryUtilization.min}
            name="gpuMemoryUtilization"
            onChange={(_, value) => formik.setFieldValue('gpuMemoryUtilization', value)}
            step={0.05}
            topRight={`${MODEL_PARAM_BOUNDS.gpuMemoryUtilization.min} - ${MODEL_PARAM_BOUNDS.gpuMemoryUtilization.max}`}
            value={v.gpuMemoryUtilization}
            valueLabelFormat={(value) => Number(value).toFixed(2)}
          />
          {/* Only meaningful with more than one GPU booked; with a single GPU there's nothing to shard
              across, so the field is hidden and the flag is never emitted. */}
          {bookedGpus > 1 && (
            <Slider
              errorText={errorFor('tensorParallelSize')}
              hint="--tensor-parallel-size"
              label={labelWithInfo(
                `Tensor parallelism - ${v.tensorParallelSize ?? 1}`,
                'How many GPUs to split the model across. 1 keeps it on a single GPU; higher shards the weights so a model too big for one GPU fits, and can speed up inference. Can’t exceed the GPUs you booked, and some models require a value that divides their attention heads evenly.'
              )}
              max={bookedGpus}
              min={1}
              name="tensorParallelSize"
              onChange={(_, value) => formik.setFieldValue('tensorParallelSize', value)}
              step={1}
              topRight={`1 - ${bookedGpus}`}
              value={v.tensorParallelSize ?? 1}
              valueLabelFormat={(value) => String(value)}
            />
          )}
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
            value={v.kvCacheDtype}
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
            value={v.revision}
          />
          <div>
            <Switch
              checked={v.enforceEager}
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
  );

  // llama.cpp cold launch flags — serves a GGUF quantization off the Hub. `v` is the narrowed
  // llama.cpp branch of the form values.
  const renderLlamaCppFlags = (v: LlamaCppParameters) => (
    <div className={styles.subsection}>
      <div>
        <h4>llama.cpp launch flags</h4>
        <div className="textSecondary">Fixed when the model starts — changing them requires a restart</div>
      </div>
      <div className={styles.grid}>
        <div className={styles.column}>
          <Input
            size="sm"
            errorText={errorFor('servedModelName')}
            hint="--alias"
            label={labelWithInfo(
              'Served model name',
              'The name the running model answers to — clients put this in the request `model` field. A routing label only; if wrong, clients can’t address the model.'
            )}
            name="servedModelName"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            placeholder="model"
            type="text"
            value={v.servedModelName}
          />
          <Input
            size="sm"
            errorText={errorFor('ggufRepo')}
            hint="-hf (repo)"
            label={labelWithInfo(
              'GGUF repo',
              'The Hugging Face repo llama.cpp pulls the GGUF from — a `*-GGUF` repo, NOT the raw-weights repo. On startup llama.cpp downloads this from the Hub. Seeded as a best guess; correct it to a repo that actually ships GGUF files.'
            )}
            name="ggufRepo"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            placeholder="bartowski/phi-4-GGUF"
            type="text"
            value={v.ggufRepo}
          />
          <Input
            size="sm"
            hint="-hf (:quant)"
            label={labelWithInfo(
              'Quantization',
              'Which quantization file inside the repo to load — the tag after the `:` in `-hf repo:quant`. Q4_K_M is a common size/quality balance. Leave blank to let llama.cpp pick from the repo.'
            )}
            name="ggufQuant"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            placeholder="Q4_K_M"
            type="text"
            value={v.ggufQuant}
          />
          <Input
            size="sm"
            errorText={errorFor('contextLength')}
            hint="-c"
            label={labelWithInfo(
              'Context length',
              'Max tokens (input + output combined) per request. Leave blank to use the model’s trained default; set a number to pin it. Higher uses more RAM for the KV cache.'
            )}
            name="contextLength"
            onBlur={formik.handleBlur}
            onChange={(e) => {
              const raw = e.target.value.trim();
              formik.setFieldValue('contextLength', raw === '' ? null : Number(raw));
            }}
            placeholder="Model default"
            type="number"
            value={v.contextLength ?? ''}
          />
        </div>

        <div className={styles.column}>
          <Input
            size="sm"
            errorText={errorFor('gpuLayers')}
            hint="-ngl"
            label={labelWithInfo(
              'GPU layers',
              'How many model layers to offload to the GPU. 0 runs entirely on CPU (works everywhere). Higher moves more of the model onto the GPU for speed — needs a CUDA host/build and enough VRAM.'
            )}
            name="gpuLayers"
            onBlur={formik.handleBlur}
            onChange={(e) => formik.setFieldValue('gpuLayers', Number(e.target.value))}
            placeholder="0"
            type="number"
            value={v.gpuLayers}
          />
          <div>
            <Switch
              checked={v.jinja}
              label={labelWithInfo(
                'Chat template (Jinja)',
                'Enables the model’s built-in Jinja chat template so multi-turn chat and tool calls format correctly. Keep on for chat models.',
                true
              )}
              name="jinja"
              onChange={(_, checked) => formik.setFieldValue('jinja', checked)}
            />
            <div className="textSecondary">--jinja</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Full-card spinner only on first load; later reloads keep the form visible.
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
          <h3 className={styles.headName}>{getModelShortName(modelId)}</h3>
          <Button
            color="accent1"
            contentBefore={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            size="sm"
            type="button"
            variant="transparent"
          >
            {open ? 'Hide' : 'Parameters'}
          </Button>
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
          {/* Engine picks the runtime (image/port/command) and which launch flags below are shown. */}
          <div className={styles.subsection}>
            <div>
              <h4>Inference engine</h4>
              <div className="textSecondary">
                Switching resets the launch flags below — vLLM and llama.cpp take different settings.
              </div>
            </div>
            <Select<InferenceEngine>
              size="sm"
              label={labelWithInfo(
                'Engine',
                'vLLM serves the raw Hugging Face weights on a CUDA GPU; llama.cpp serves a GGUF quantization and can run on CPU. The choice sets the container image, port and launch command.'
              )}
              name="engine"
              onChange={(e) => setEngine(e.target.value as InferenceEngine)}
              options={INFERENCE_ENGINE_OPTIONS}
              value={engine}
            />
          </div>

          <div className={styles.divider} />

          {/* Custom parameters — extra launch flags as key/value pairs. Only rule: non-empty, unique keys. */}
          <div className={styles.subsection}>
            <div className={styles.subsectionHead}>
              <div>
                <h4>Model parameters</h4>
                <div className="textSecondary">
                  Extra launch flags, appended to the engine command as <code>--key value</code>. You don&apos;t need to
                  add the leading <code>--</code>.
                  <br />
                  Leave the value empty for an on/off flag. Flags added here override the same flags set below.
                </div>
              </div>
              <Button
                color="accent2"
                contentBefore={<AddIcon />}
                onClick={addCustomParam}
                size="md"
                type="button"
                variant="filled"
              >
                Add parameter
              </Button>
            </div>
            {formik.values.customParams.length > 0 && (
              <div className={styles.paramRows}>
                {formik.values.customParams.map((param, index) => (
                  <div className={styles.paramRow} key={index}>
                    <Input
                      size="sm"
                      errorText={customParamKeyError(index)}
                      name={`customParams.${index}.key`}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                      startAdornment={<div style={{ whiteSpace: 'nowrap' }}>Key: --</div>}
                      type="text"
                      value={param.key}
                    />
                    <Input
                      className={styles.paramValueInput}
                      size="sm"
                      name={`customParams.${index}.value`}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                      startAdornment="Val:"
                      type="text"
                      value={param.value}
                    />
                    <Button
                      color="accent1"
                      onClick={() => removeCustomParam(index)}
                      size="md-const"
                      type="button"
                      variant="outlined"
                    >
                      <DeleteOutlineIcon />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {formik.values.engine === 'vllm' ? renderVllmFlags(formik.values) : renderLlamaCppFlags(formik.values)}
        </section>
      </Collapse>
    </Card>
  );
});

export default ModelParameters;
