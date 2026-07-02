import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import ProgressBar from '@/components/progress-bar/progress-bar';
import SectionTitle from '@/components/section-title/section-title';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { getModelAvatarUrl } from '@/services/huggingface-service';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
import { formatDuration } from '@/utils/formatters';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopIcon from '@mui/icons-material/Stop';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './manage-service-page.module.css';

type Endpoint = {
  method: 'GET' | 'POST';
  path: string;
  description: string;
};

const ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/chat', description: 'Send a prompt / chat message · SSE streaming' },
  { method: 'GET', path: '/v1/models', description: 'List loaded models and status' },
  { method: 'POST', path: '/v1/chat/completions', description: 'Chat completions · SSE streaming' },
  { method: 'POST', path: '/v1/completions', description: 'Legacy text completions' },
  { method: 'POST', path: '/v1/embeddings', description: 'Embeddings (if supported)' },
];

type ServiceModel = {
  model: HuggingFaceModel;
  params: ModelParameters;
};

// TODO replace with real service lookup by id.
function getMockService(id: string) {
  const models: ServiceModel[] = [
    {
      model: { id: 'Qwen/Qwen3-8B', author: 'Qwen', pipelineTag: 'text-generation' },
      params: {
        servedModelName: 'qwen3-8b',
        maxContext: 32768,
        gpuMemoryUtilization: 0.9,
        quantization: 'none',
        dtype: 'bfloat16',
        kvCacheDtype: 'auto',
        trustRemoteCode: false,
        enforceEager: false,
        revision: '',
        toolCalling: true,
        toolCallParser: 'hermes',
      },
    },
    {
      model: { id: 'BAAI/bge-large-en-v1.5', author: 'BAAI', pipelineTag: 'feature-extraction' },
      params: {
        servedModelName: 'bge-large',
        maxContext: 8192,
        gpuMemoryUtilization: 0.4,
        quantization: 'none',
        dtype: 'float16',
        kvCacheDtype: 'auto',
        trustRemoteCode: true,
        enforceEager: false,
        revision: 'main',
        toolCalling: false,
        toolCallParser: null,
      },
    },
  ];

  const usdc = getSupportedTokens().USDC.address;

  const environment: ComputeEnvironment = {
    id: 'env-h100x2',
    nodeId: 'node07',
    consumerAddress: '0x0000000000000000000000000000000000dEaD',
    resources: [
      { id: 'cpu', type: 'cpu', max: 32, min: 1, total: 32 },
      { id: 'ram', type: 'ram', max: 256, min: 1, total: 256 },
      { id: 'disk', type: 'disk', max: 512, min: 1, total: 512 },
      { id: 'gpu-h100-1', type: 'gpu', description: 'NVIDIA H100 80GB', max: 1, min: 0, total: 1 },
      { id: 'gpu-h100-2', type: 'gpu', description: 'NVIDIA H100 80GB', max: 1, min: 0, total: 1 },
    ],
    fees: {
      [CHAIN_ID]: [
        {
          feeToken: usdc,
          prices: [
            { id: 'cpu', price: 0.0006 },
            { id: 'ram', price: 0.00008 },
            { id: 'disk', price: 0.00004 },
            { id: 'gpu-h100-1', price: 0.05 },
            { id: 'gpu-h100-2', price: 0.05 },
          ],
        },
      ],
    },
  } as ComputeEnvironment;

  const nodeInfo: EnvNodeInfo = { id: 'node07', friendlyName: 'chicken-tennessee-hawaii-seven' };

  return {
    id,
    name: 'Qwen3 8B + BGE',
    runtime: 'vLLM',
    status: 'Running' as const,
    baseUrl: 'https://node07.oncompute.ai/api/inference',
    bearer: 'oc_3f9a2b7c8d1e4f5061728394a5b6c7d8',
    models,
    environment,
    nodeInfo,
    tokenAddress: usdc,
    gpuSelection: { 'NVIDIA H100 80GB': 2 },
    duration: {
      totalSeconds: 4 * 3600, // 4h purchased
      elapsedSeconds: 12 * 60, // 12 min in
    },
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatHMS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Live time-running progress bar with a ticking countdown to session end. */
const DurationProgress: React.FC<{ totalSeconds: number; elapsedSeconds: number }> = ({
  totalSeconds,
  elapsedSeconds,
}) => {
  const [elapsed, setElapsed] = useState(elapsedSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => Math.min(prev + 1, totalSeconds));
    }, 1000);
    return () => clearInterval(timer);
  }, [totalSeconds]);

  const remaining = Math.max(0, totalSeconds - elapsed);
  const percent = totalSeconds > 0 ? Math.min(100, (elapsed / totalSeconds) * 100) : 0;
  const expired = remaining <= 0;

  return (
    <ProgressBar
      className={cx(styles.duration, { [styles.durationExpired]: expired })}
      topLeftContent={
        <span className={styles.durationRatio}>
          Uptime {formatHMS(elapsed)} / {formatDuration(totalSeconds, true)}
        </span>
      }
      topRightContent={
        <span className={styles.durationLabel}>
          {expired ? 'Session ended' : 'Time remaining'}
          <span className={styles.countdown}>{formatHMS(remaining)}</span>
        </span>
      }
      value={percent}
    />
  );
};

type ParamRow = {
  label: string;
  value: React.ReactNode;
  flag: string;
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

const ManageServicePage: React.FC = () => {
  const params = useParams<{ serviceId?: string }>();
  const id = params.serviceId ? decodeURIComponent(params.serviceId) : '';
  const [revealed, setRevealed] = useState(false);

  const service = getMockService(id);

  const maskedBearer = `${service.bearer.slice(0, 3)}${'•'.repeat(20)}`;
  const primaryModelName = service.models[0]?.params.servedModelName ?? 'model';

  const curlSnippet = `# quick test
curl $BASE/api/chat \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{ "model": "${primaryModelName}", "messages": [ … ] }'`;

  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Manage Service" subTitle="Usage, environment & how to call your endpoint" />

      <div className="pageContentWrapper">
        {/* Header */}
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="lg" variant="glass-shaded">
          <div className={styles.header}>
            <div>
              <h3>{service.name}</h3>
              <div className={styles.meta}>Custom selection</div>
            </div>
            <span className={cx('chip', styles.statusChip)}>
              <span className={styles.statusDot} />
              {service.status}
            </span>
          </div>

          <DurationProgress
            elapsedSeconds={service.duration.elapsedSeconds}
            totalSeconds={service.duration.totalSeconds}
          />

          <div className="actionsGroupMdBetween">
            <div className="actionsGroupMdEnd">
              <Button color="accent1" contentBefore={<StopIcon />} size="md" variant="outlined">
                Stop
              </Button>
              <Button color="accent1" contentBefore={<RestartAltIcon />} size="md" variant="outlined">
                Restart
              </Button>
            </div>
            <div className="actionsGroupMdEnd">
              <Button color="accent1" contentBefore={<EditOutlinedIcon />} size="md" variant="outlined">
                Edit
              </Button>
              <Button color="accent1" contentBefore={<BoltOutlinedIcon />} size="md" variant="filled">
                Prolong session
              </Button>
            </div>
          </div>
        </Card>

        {/* Models */}
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <div className={styles.howToHead}>
            <h3>Models</h3>
            <span className="textSecondary">{service.models.length} loaded · expand for launch parameters</span>
          </div>
          <div className={styles.modelList}>
            {service.models.map((entry) => (
              <ModelRow entry={entry} key={entry.model.id} />
            ))}
          </div>
        </Card>

        {/* Environment */}
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <div className={styles.howToHead}>
            <h3>Environment</h3>
            <span className="textSecondary">Running for {formatDuration(service.duration.totalSeconds)}</span>
          </div>
          <InferenceEnvironmentCard
            durationSeconds={service.duration.totalSeconds}
            environment={service.environment}
            gpuSelection={service.gpuSelection}
            nodeInfo={service.nodeInfo}
          />
        </Card>

        {/* How to use */}
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <div className={styles.howToHead}>
            <h3>How to use</h3>
            <span className="textSecondary">OpenWebUI-compatible · drop-in replacement</span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Base URL</span>
            <span className={styles.fieldValue}>{service.baseUrl}</span>
            <CopyButton color="accent1" contentToCopy={service.baseUrl} variant="outlined" />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Bearer</span>
            <span className={cx(styles.fieldValue, styles.mono)}>{revealed ? service.bearer : maskedBearer}</span>
            <Button color="accent1" onClick={() => setRevealed((prev) => !prev)} size="sm" variant="outlined">
              {revealed ? 'Hide' : 'Reveal'}
            </Button>
            <CopyButton color="accent1" contentToCopy={service.bearer} size="sm" variant="outlined" />
          </div>

          {ENDPOINTS.map((endpoint) => (
            <div className={styles.endpoint} key={`${endpoint.method}-${endpoint.path}`}>
              <span className={cx(styles.method, endpoint.method === 'GET' ? styles.methodGet : styles.methodPost)}>
                {endpoint.method}
              </span>
              <span className={styles.endpointPath}>{endpoint.path}</span>
              <span className={styles.endpointDescription}>{endpoint.description}</span>
              <CopyButton color="accent1" contentToCopy={`${service.baseUrl}${endpoint.path}`} variant="outlined" />
            </div>
          ))}

          <pre className={styles.codeBlock}>{curlSnippet}</pre>
        </Card>
      </div>
    </Container>
  );
};

export default ManageServicePage;
