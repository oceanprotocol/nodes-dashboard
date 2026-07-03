import Card from '@/components/card/card';
import { getModelAvatarUrl, getModelShortName, isGenerativePipeline } from '@/services/huggingface-service';
import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
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

function prettyPipeline(tag?: string): string {
  if (!tag) {
    return 'Model';
  }
  return tag
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type ParamRow = {
  label: string;
  value: React.ReactNode;
  flag: string;
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

  // Headline specs shown inline; the rest live behind the toggle. Each guarded independently so a
  // partial params object (e.g. from an older URL) just omits the missing chips rather than throwing.
  const specs = params
    ? ([
        params.maxContext != null && `${params.maxContext.toLocaleString()} ctx`,
        params.dtype,
        params.quantization && params.quantization !== 'none' && params.quantization,
        params.toolCalling && 'tools',
      ].filter(Boolean) as string[])
    : [];

  // Sampling defaults only apply to generative pipelines; embeddings etc. don't sample.
  const isGenerative = isGenerativePipeline(model.pipelineTag);

  const generationRows: ParamRow[] = [
    { label: 'Temperature', value: show(params?.temperature, (v) => v.toFixed(2)), flag: 'temperature' },
    { label: 'Top P', value: show(params?.topP, (v) => v.toFixed(2)), flag: 'top_p' },
    { label: 'Top K', value: show(params?.topK, (v) => (v === -1 ? 'Off' : v)), flag: 'top_k' },
    {
      label: 'Repetition penalty',
      value: show(params?.repetitionPenalty, (v) => v.toFixed(2)),
      flag: 'repetition_penalty',
    },
  ];

  const engineRows: ParamRow[] = [
    { label: 'Max context', value: show(params?.maxContext, (v) => v.toLocaleString()), flag: '--max-model-len' },
    {
      label: 'GPU memory',
      value: show(params?.gpuMemoryUtilization, (v) => v.toFixed(2)),
      flag: '--gpu-memory-utilization',
    },
    { label: 'dtype', value: show(params?.dtype, (v) => v), flag: '--dtype' },
    {
      label: 'Quantization',
      value: show(params?.quantization, (v) => (v === 'none' ? 'None' : v)),
      flag: '--quantization',
    },
    { label: 'KV cache', value: show(params?.kvCacheDtype, (v) => v), flag: '--kv-cache-dtype' },
    { label: 'Revision', value: show(params?.revision, (v) => v || 'main'), flag: '--revision' },
    {
      label: 'Trust remote code',
      value: show(params?.trustRemoteCode, (v) => (v ? 'On' : 'Off')),
      flag: '--trust-remote-code',
    },
    { label: 'Enforce eager', value: show(params?.enforceEager, (v) => (v ? 'On' : 'Off')), flag: '--enforce-eager' },
    {
      label: 'Tool parser',
      value: show(params?.toolCalling, (v) => (v ? (params?.toolCallParser ?? '—') : 'Off')),
      flag: '--tool-call-parser',
    },
  ];

  const groups: ParamGroup[] = [
    ...(isGenerative ? [{ eyebrow: 'Model · generation', rows: generationRows }] : []),
    { eyebrow: 'vLLM engine', rows: engineRows },
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
            {prettyPipeline(model.pipelineTag)} · {model.id}
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
