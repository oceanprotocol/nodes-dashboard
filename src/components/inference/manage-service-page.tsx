import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopIcon from '@mui/icons-material/Stop';
import cx from 'classnames';
import { useParams } from 'next/navigation';
import { useState } from 'react';
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

// TODO replace with real service lookup by id.
function getMockService(id: string) {
  return {
    id,
    name: 'Qwen3 8B',
    modelId: 'qwen3-8b',
    runtime: 'vLLM',
    node: 'chicken-tennessee-hawaii-seven',
    startedAgo: '12 min ago',
    timeRemaining: '03:58:12',
    status: 'Running' as const,
    baseUrl: 'https://node07.oncompute.ai/api/inference',
    bearer: 'oc_3f9a2b7c8d1e4f5061728394a5b6c7d8',
  };
}

const ManageServicePage: React.FC = () => {
  const params = useParams<{ serviceId?: string }>();
  const id = params.serviceId ? decodeURIComponent(params.serviceId) : '';
  const [revealed, setRevealed] = useState(false);

  const service = getMockService(id);

  const maskedBearer = `${service.bearer.slice(0, 3)}${'•'.repeat(20)}`;

  const curlSnippet = `# quick test
curl $BASE/api/chat \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{ "model": "${service.modelId}", "messages": [ … ] }'`;

  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Manage Service" subTitle="Usage, machine load & how to call your endpoint" />

      <div className="pageContentWrapper">
        {/* Header */}
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <div className={styles.header}>
            <div className={styles.identity}>
              <div className={styles.avatar} />
              <div>
                <h3 className={styles.name}>{service.name}</h3>
                <div className={styles.meta}>
                  Custom · {service.runtime} · node {service.node.slice(0, 18)}… · started {service.startedAgo}
                </div>
              </div>
            </div>
            <div className={styles.statusGroup}>
              <div className={styles.timeBox}>
                <span className={styles.timeLabel}>Time remaining</span>
                <span className={styles.timeValue}>{service.timeRemaining}</span>
              </div>
              <span className={cx('chip', styles.statusChip)}>
                <span className={styles.statusDot} />
                {service.status}
              </span>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.actions}>
            <Button color="accent1" contentBefore={<BoltOutlinedIcon />} size="md" variant="filled">
              Prolong session
            </Button>
            <Button color="accent1" contentBefore={<EditOutlinedIcon />} size="md" variant="outlined">
              Edit service
            </Button>
            <Button color="accent1" contentBefore={<RestartAltIcon />} size="md" variant="outlined">
              Restart <span className={styles.actionHint}>(kill + start)</span>
            </Button>
            <Button color="accent1" contentBefore={<StopIcon />} disabled size="md" variant="outlined">
              Stop
            </Button>
          </div>
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
            <CopyButton color="accent1" contentToCopy={service.bearer} variant="outlined" />
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
