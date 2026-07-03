import Card from '@/components/card/card';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { useState } from 'react';
import styles from './inference-model-list.module.css';

export type ServiceModel = {
  model: HuggingFaceModel;
  params: ModelParameters;
};

/** Params fall back to these when a model in the selection has none committed yet. */
export function fallbackParams(modelId: string): ModelParameters {
  return {
    servedModelName: getModelShortName(modelId),
    maxContext: 32768,
    gpuMemoryUtilization: 0.9,
    quantization: 'none',
    dtype: 'auto',
    kvCacheDtype: 'auto',
    trustRemoteCode: false,
    enforceEager: false,
    revision: '',
    toolCalling: false,
    toolCallParser: null,
  };
}

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

/** Compact model row — served name + key specs inline, full launch params in a collapsible panel. */
const ModelRow: React.FC<{ entry: ServiceModel }> = ({ entry }) => {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { model, params } = entry;
  const avatarUrl = getModelAvatarUrl(model);
  const initial = (model.author ?? model.id).charAt(0).toUpperCase();

  // Headline specs shown inline; the rest live behind the toggle.
  const specs = [
    `${params.maxContext.toLocaleString()} ctx`,
    params.dtype,
    params.quantization !== 'none' && params.quantization,
    params.toolCalling && 'tools',
  ].filter(Boolean) as string[];

  const rows: ParamRow[] = [
    { label: 'GPU memory', value: params.gpuMemoryUtilization.toFixed(2), flag: '--gpu-memory-utilization' },
    { label: 'KV cache', value: params.kvCacheDtype, flag: '--kv-cache-dtype' },
    { label: 'Revision', value: params.revision || 'main', flag: '--revision' },
    { label: 'Trust remote code', value: params.trustRemoteCode ? 'On' : 'Off', flag: '--trust-remote-code' },
    { label: 'Enforce eager', value: params.enforceEager ? 'On' : 'Off', flag: '--enforce-eager' },
    {
      label: 'Tool parser',
      value: params.toolCalling ? (params.toolCallParser ?? '—') : 'Off',
      flag: '--tool-call-parser',
    },
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
          <span className={styles.modelName}>{params.servedModelName}</span>
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
        <dl className={styles.paramsGrid}>
          {rows.map((row) => (
            <div className={styles.paramItem} key={row.flag}>
              <dt className={styles.paramLabel}>{row.label}</dt>
              <dd className={styles.paramValue}>{row.value}</dd>
              <code className={styles.paramFlag}>{row.flag}</code>
            </div>
          ))}
        </dl>
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
