import Card from '@/components/card/card';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
import { formatPipelineTag } from '@/utils/formatters';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { useState } from 'react';
import styles from './inference-model-list.module.css';

export type ServiceModel = {
  model: HuggingFaceModel;
  /** Committed launch params. Undefined when a model was never configured — rendered as N/A. */
  params?: ModelParameters;
};

type ParamRow = {
  label: string;
  value: React.ReactNode;
  flag?: string;
};

type ParamGroup = {
  /** Whose setting this is — the model's own generation defaults vs. the vLLM engine flags. */
  eyebrow: string;
  rows: ParamRow[];
};

/** Compact model row — served name + key specs inline, full launch params in a collapsible panel. */
const ModelRow: React.FC<{ entry: ServiceModel }> = ({ entry }) => {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { model, params } = entry;
  const avatarUrl = getModelAvatarUrl(model);
  const initial = (model.author ?? model.id).charAt(0).toUpperCase();

  // Render a single param value, or N/A when the model has no params or that field is missing
  // (e.g. a params object hydrated from an older URL that predates a field). Guards per-field, not
  // just per-object, so a partial object degrades to N/A instead of throwing.
  const show = <T,>(value: T | null | undefined, format: (v: T) => React.ReactNode): React.ReactNode =>
    value === null || value === undefined ? 'N/A' : format(value);

  const isLlama = params?.engine === 'llamacpp';

  // Headline specs shown inline; the rest live behind the toggle. Each guarded independently so a
  // partial params object (e.g. from an older URL) just omits the missing chips rather than throwing.
  // vLLM and llama.cpp expose different fields, so the chip set is engine-specific.
  let specs: string[] = [];
  if (params?.engine === 'llamacpp') {
    specs = [
      params.contextLength != null && `${params.contextLength.toLocaleString()} ctx`,
      params.ggufQuant || undefined,
      params.gpuLayers > 0 && `${params.gpuLayers} gpu layers`,
    ].filter(Boolean) as string[];
  } else if (params?.engine === 'vllm') {
    specs = [
      params.maxContext != null && `${params.maxContext.toLocaleString()} ctx`,
      params.dtype,
      params.quantization !== 'none' && params.quantization,
      params.toolCalling && 'tools',
    ].filter(Boolean) as string[];
  }

  // User-defined key/value params (env-var style). Each becomes a row; the flag is its key.
  const customRows: ParamRow[] = (params?.customParams ?? []).map((param) => ({
    label: param.key,
    value: param.value || 'N/A',
  }));

  // The cold-launch flag rows, per engine. Labels double as the flag column below.
  const engineRows: ParamRow[] =
    params?.engine === 'llamacpp'
      ? [
          { label: 'GGUF repo', value: show(params.ggufRepo || undefined, (v) => v), flag: '-hf' },
          { label: 'Quantization', value: show(params.ggufQuant || undefined, (v) => v), flag: '-hf :quant' },
          { label: 'Context length', value: show(params.contextLength, (v) => v.toLocaleString()), flag: '-c' },
          { label: 'GPU layers', value: show(params.gpuLayers, (v) => String(v)), flag: '-ngl' },
          { label: 'Chat template', value: show(params.jinja, (v) => (v ? 'On' : 'Off')), flag: '--jinja' },
        ]
      : [
          {
            label: 'Max context',
            value: show(params?.engine === 'vllm' ? params.maxContext : undefined, (v) => v.toLocaleString()),
            flag: '--max-model-len',
          },
          {
            label: 'GPU memory',
            value: show(params?.engine === 'vllm' ? params.gpuMemoryUtilization : undefined, (v) => v.toFixed(2)),
            flag: '--gpu-memory-utilization',
          },
          { label: 'dtype', value: show(params?.engine === 'vllm' ? params.dtype : undefined, (v) => v), flag: '--dtype' },
          {
            label: 'Quantization',
            value: show(params?.engine === 'vllm' ? params.quantization : undefined, (v) => (v === 'none' ? 'None' : v)),
            flag: '--quantization',
          },
          {
            label: 'KV cache',
            value: show(params?.engine === 'vllm' ? params.kvCacheDtype : undefined, (v) => v),
            flag: '--kv-cache-dtype',
          },
          {
            label: 'Revision',
            value: show(params?.engine === 'vllm' ? params.revision : undefined, (v) => v || 'main'),
            flag: '--revision',
          },
          {
            label: 'Trust remote code',
            value: show(params?.engine === 'vllm' ? params.trustRemoteCode : undefined, (v) => (v ? 'On' : 'Off')),
            flag: '--trust-remote-code',
          },
          {
            label: 'Enforce eager',
            value: show(params?.engine === 'vllm' ? params.enforceEager : undefined, (v) => (v ? 'On' : 'Off')),
            flag: '--enforce-eager',
          },
          {
            label: 'Tool parser',
            value: show(params?.engine === 'vllm' ? params.toolCalling : undefined, (v) =>
              v ? ((params?.engine === 'vllm' && params.toolCallParser) ?? '—') : 'Off'
            ),
            flag: '--tool-call-parser',
          },
        ];

  const groups: ParamGroup[] = [
    ...(customRows.length > 0 ? [{ eyebrow: 'Model parameters', rows: customRows }] : []),
    { eyebrow: isLlama ? 'llama.cpp engine' : 'vLLM engine', rows: engineRows },
  ];

  return (
    <Card direction="column" innerShadow="black" radius="sm" variant="glass">
      <button aria-expanded={open} className={styles.modelRow} onClick={() => setOpen((prev) => !prev)} type="button">
        <span className={styles.modelAvatar}>
          {avatarUrl && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={model.author ?? model.id} onError={() => setAvatarFailed(true)} src={avatarUrl} />
          ) : (
            initial
          )}
        </span>
        <span className={styles.modelIdentity}>
          <span className={styles.modelName}>{params?.servedModelName ?? getModelShortName(model.id)}</span>
          <span className={styles.modelSub}>
            {formatPipelineTag(model.pipelineTag, 'Model')} · {model.id}
          </span>
        </span>
        <span className={styles.modelSpecs}>
          {specs.map((spec) => (
            <span className={cx('chip', 'chipGlass', styles.specChip)} key={spec}>
              {spec}
            </span>
          ))}
        </span>
        <ExpandMoreIcon className={cx(styles.chevron, { [styles.chevronOpen]: open })} fontSize="small" />
      </button>
      <Collapse in={open} unmountOnExit>
        <div className={styles.paramsPanel}>
          {groups.map((group) => (
            <div className={styles.paramGroup} key={group.eyebrow}>
              <span className={styles.paramGroupEyebrow}>{group.eyebrow}</span>
              <dl className={styles.paramsGrid}>
                {group.rows.map((row) => (
                  <div className={styles.paramItem} key={row.flag}>
                    <dt className={styles.paramLabel}>{row.label}</dt>
                    <dd className={styles.paramValue}>{row.value}</dd>
                    <code className={styles.paramFlag}>{row.flag}</code>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Collapse>
    </Card>
  );
};

/** Shared list of selected models with per-model launch parameters (used by payment + manage pages). */
const InferenceModelList: React.FC<{ models: ServiceModel[] }> = ({ models }) => {
  return (
    <div className={styles.modelList}>
      {models.map((entry) => (
        <ModelRow entry={entry} key={entry.model.id} />
      ))}
    </div>
  );
};

export default InferenceModelList;
