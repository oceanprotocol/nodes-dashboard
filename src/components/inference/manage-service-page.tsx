import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import InferenceHydrationError from '@/components/inference/inference-hydration-error';
import InferenceModelList, { ServiceModel } from '@/components/inference/inference-model-list';
import ProlongSessionModal from '@/components/inference/prolong-session-modal';
import ServiceLogsPanel from '@/components/inference/service-logs-panel';
import ProgressBar from '@/components/progress-bar/progress-bar';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { useP2P } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { getModelShortName } from '@/services/huggingface-service';
import { parseVllmCommand, toNodeUri, VLLM_PORT } from '@/services/inference-launch';
import { getServiceStatusView } from '@/services/service-status';
import { formatDuration } from '@/utils/formatters';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { CircularProgress } from '@mui/material';
import { ServiceJob, ServiceStatusNumber } from '@oceanprotocol/lib';
import cx from 'classnames';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './manage-service-page.module.css';

type Endpoint = {
  method: 'GET' | 'POST';
  path: string;
  description: string;
};

// OpenAI-compatible paths served by the vLLM container (appended to the running service's base URL).
const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/v1/models', description: 'List loaded models and status' },
  { method: 'POST', path: '/v1/chat/completions', description: 'Chat completions · SSE streaming' },
  { method: 'POST', path: '/v1/completions', description: 'Legacy text completions' },
  { method: 'POST', path: '/v1/embeddings', description: 'Embeddings (if supported)' },
  { method: 'POST', path: '/tokenize', description: 'Count / inspect prompt tokens' },
  { method: 'POST', path: '/detokenize', description: 'Token ids back to text' },
  { method: 'GET', path: '/health', description: 'Liveness probe (200 = ready)' },
  { method: 'GET', path: '/version', description: 'Running vLLM version' },
];

/** vLLM listens on 8000; prefer that endpoint, else fall back to the first exposed one. */
function serviceBaseUrl(job: ServiceJob | null): string | null {
  if (!job || job.endpoints.length === 0) {
    return null;
  }
  const vllm = job.endpoints.find((ep) => ep.containerPort === VLLM_PORT);
  return (vllm ?? job.endpoints[0]).url;
}

// How often to poll the node for the service status while it's still spinning up.
const POLL_INTERVAL_MS = 4000;
// A P2P round-trip can hang indefinitely if the node/relay is unreachable (no built-in timeout).
// Cap each status fetch so a hung dial surfaces as an error + retry instead of an eternal spinner.
const STATUS_TIMEOUT_MS = 30000;

/**
 * Reject after `ms` so a hung P2P call can't freeze the poll loop forever, and ABORT the underlying
 * dial when the timeout fires — `run` receives an AbortSignal it must forward to the transport, so a
 * timed-out request is cancelled rather than left running in the background before the next retry.
 */
function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out`));
    }, ms);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Statuses past which polling is pointless — the service reached a genuinely final state.
 * `Running` is deliberately NOT here: a running service can still crash (→ Error/Stopped) or hit
 * its expiry (→ Expired), so we keep polling for the whole session to catch those transitions.
 * Only a truly terminal status stops the loop.
 */
const TERMINAL_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.PullImageFailed,
  ServiceStatusNumber.BuildImageFailed,
  ServiceStatusNumber.VulnerableImage,
  ServiceStatusNumber.Stopped,
  ServiceStatusNumber.Expired,
  ServiceStatusNumber.Error,
]);

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
const DurationProgress: React.FC<{ totalSeconds: number; elapsedSeconds: number; onExpired?: () => void }> = ({
  totalSeconds,
  elapsedSeconds,
  onExpired,
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

  // The local countdown reaching zero is only an estimate — tell the parent so it can re-check the
  // real status with the node (polling stopped when the service reached Running).
  const expiredNotifiedRef = useRef(false);
  useEffect(() => {
    if (expired && !expiredNotifiedRef.current) {
      expiredNotifiedRef.current = true;
      onExpired?.();
    }
  }, [expired, onExpired]);

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

const ManageServicePage: React.FC = () => {
  const params = useParams<{ serviceId?: string }>();
  const router = useRouter();
  const id = params.serviceId ? decodeURIComponent(params.serviceId) : '';
  const [prolongOpen, setProlongOpen] = useState(false);

  const {
    selectedModels,
    modelParamsByModel,
    setParamsForModel,
    selectedEnv,
    selectedToken,
    setSelectedToken,
    jobDurationSeconds,
    setJobDurationSeconds,
    hydrateFromUrlFinished,
    hydrationFailed,
    buildSelectionQuery,
  } = useInferenceContext();
  const { account } = useOceanAccount();
  const { getServiceStatus, serviceRestart } = useP2P();
  const { withNodeAuth } = useNodeAuth();

  // The real service job, polled from the node until it reaches a terminal status (Running/Failed/…).
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  // Restart in flight — disables the button while it runs.
  const [actionLoading, setActionLoading] = useState<'restart' | null>(null);
  // Bumped after restart to re-kick the poll loop (harmless while it's already running).
  const [pollEpoch, setPollEpoch] = useState(0);
  // Logs stream on demand — revealed by the user, then live-tailed by ServiceLogsPanel.
  const [logsOpen, setLogsOpen] = useState(false);

  // Model/env display comes from the URL-hydrated selection — the node returns the launch command,
  // not Hugging Face metadata, so we can't reconstruct the rich model cards from the job alone.
  const hasSelection = hydrateFromUrlFinished && selectedModels.length > 0;

  const nodeUri = useMemo(() => (selectedEnv ? toNodeUri(selectedEnv.nodeInfo) : null), [selectedEnv]);
  const nodePeerId = selectedEnv?.nodeInfo.id;

  /**
   * Fetch the service status once, returning true when it has reached a terminal state (stop polling).
   */
  const fetchStatus = useCallback(async (): Promise<boolean> => {
    if (!nodeUri || !nodePeerId || !account.address || !id) {
      return false;
    }
    try {
      // Reuse the node's cached auth token (shared with the logs stream & actions) so the 4s poll
      // doesn't mint a fresh token every tick — concurrent token creation collides on the node's
      // per-address nonce. withNodeAuth transparently re-mints once on a 401.
      const jobs = await withNodeAuth(nodePeerId, nodeUri, (token) =>
        withTimeout((signal) => getServiceStatus(nodeUri, token, id, signal), STATUS_TIMEOUT_MS, 'Service status')
      );
      const found = jobs.find((j) => j.serviceId === id) ?? jobs[0] ?? null;
      setJob(found);
      setJobError(null);
      setJobLoading(false);
      // Running is NOT terminal (see TERMINAL_STATUSES) — keep polling a running service so a later
      // crash (Error/Stopped) or expiry (Expired) is caught. Only a final status stops the loop.
      return !!found && TERMINAL_STATUSES.has(found.status);
    } catch (error) {
      console.error('Failed to fetch service status:', error);
      setJobError(error instanceof Error ? error.message : 'Failed to load service status.');
      setJobLoading(false);
      return false; // keep polling — transient network errors shouldn't stop the watch
    }
  }, [nodeUri, nodePeerId, account.address, id, withNodeAuth, getServiceStatus]);

  // Poll until terminal. Wait for hydration so nodeUri (from the selected env) is available.
  useEffect(() => {
    if (!hydrateFromUrlFinished || !nodeUri || !account.address) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const done = await fetchStatus();
      if (!cancelled && !done) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hydrateFromUrlFinished, nodeUri, account.address, fetchStatus, pollEpoch]);

  // Seed the payment token from the running service itself once it loads, when the URL-hydrated
  // selection didn't carry one (e.g. token-symbol lookup failed during hydration). This is the
  // authoritative token the service was started with, so an Edit relaunch reuses it rather than
  // tripping the "missing payment token" guard on the payment step.
  useEffect(() => {
    const paymentToken = job?.payment?.token;
    if (!paymentToken || selectedToken?.address?.toLowerCase() === paymentToken.toLowerCase()) {
      return;
    }
    let cancelled = false;
    (async () => {
      let symbol: string | null = null;
      try {
        symbol = await getTokenSymbol(paymentToken);
      } catch (error) {
        console.error('Failed to resolve service token symbol:', error);
      }
      if (!cancelled) {
        setSelectedToken({ address: paymentToken, symbol: symbol ?? '' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job?.payment?.token, selectedToken?.address, setSelectedToken]);

  // Seed the model launch params from the running service's own dockerCmd when the URL didn't carry
  // them (e.g. opened from the services table, which only puts models/env/duration on the query).
  // Recovering them from the job keeps the Model card and a prolong summary from rendering N/A, and
  // gives an Edit relaunch the committed params it needs. Only fills a model that has none yet — a
  // full config committed earlier in-flow always wins.
  useEffect(() => {
    const cmd = job?.dockerCmd;
    if (!cmd || selectedModels.length === 0) {
      return;
    }
    const parsed = parseVllmCommand(cmd);
    const target = parsed.modelId ? selectedModels.find((m) => m.id === parsed.modelId) : selectedModels[0];
    if (!target || modelParamsByModel[target.id]) {
      return;
    }
    setParamsForModel(target.id, parsed.params);
  }, [job?.dockerCmd, selectedModels, modelParamsByModel, setParamsForModel]);

  /**
   * Restart the running container in place, then re-kick the status poll so the page tracks the transition (Running → Starting → Running).
   */
  const runServiceAction = useCallback(
    async (action: 'restart') => {
      if (!nodeUri || !nodePeerId || !account.address || !id) {
        return;
      }
      setActionLoading(action);
      setJobError(null);
      try {
        // Same cached token as the poll loop — avoids a concurrent createAuthToken (nonce clash)
        // when the user acts while a poll tick is in flight.
        await withNodeAuth(nodePeerId, nodeUri, (token) => serviceRestart(nodeUri, token, id));
        setPollEpoch((epoch) => epoch + 1);
      } catch (error) {
        console.error(`Failed to ${action} service:`, error);
        setJobError(error instanceof Error ? error.message : `Failed to ${action} service.`);
      } finally {
        setActionLoading(null);
      }
    },
    [nodeUri, nodePeerId, account.address, id, withNodeAuth, serviceRestart]
  );

  const models: ServiceModel[] = useMemo(
    () => selectedModels.map((model) => ({ model, params: modelParamsByModel[model.id] })),
    [selectedModels, modelParamsByModel]
  );

  const environment = selectedEnv?.environment ?? null;
  const nodeInfo = selectedEnv?.nodeInfo ?? null;
  const gpuSelection = selectedEnv?.gpuSelection;
  const nowSeconds = Math.floor(Date.now() / 1000);
  // Derive total + elapsed from the job's own start (dateCreated) and expiry, so both stay
  // consistent with the ACTUAL window — including after a Prolong/Extend, which pushes expiresAt
  // forward while leaving job.duration at the original paid value. Falling back to job.duration for
  // the total would make the bar/countdown wrong after an extend. Only fall back to the requested
  // duration before the job has loaded. `expiresAt` is ms; `dateCreated` is an ISO timestamp.
  const jobStartSeconds = job ? Math.floor(new Date(job.dateCreated).getTime() / 1000) : 0;
  const jobExpirySeconds = job ? Math.floor(job.expiresAt / 1000) : 0;
  const durationTotalSeconds =
    job && Number.isFinite(jobStartSeconds) && jobExpirySeconds > jobStartSeconds
      ? jobExpirySeconds - jobStartSeconds
      : jobDurationSeconds;
  const durationElapsedSeconds = job ? Math.max(0, Math.min(durationTotalSeconds, nowSeconds - jobStartSeconds)) : 0;
  const defaultToken = selectedToken?.address;
  const serviceName = hasSelection
    ? models.map((m) => getModelShortName(m.model.id)).join(' + ') || 'Custom selection'
    : id;

  const status = job
    ? getServiceStatusView(job.status, job.statusText)
    : { kind: 'pending' as const, label: jobLoading ? 'Loading…' : 'Unknown' };
  const isRunning = job?.status === ServiceStatusNumber.Running;
  // The node refuses serviceRestart once the paid window is up — it rejects both the Expired status
  // AND any job already past its expiry (the expiry cron flips the status asynchronously, so a
  // service can be past expiresAt while still reading Running). Mirror that here so Edit/Restart
  // aren't offered when the relaunch is guaranteed to fail. `expiresAt` is ms.
  const isExpired = !!job && (job.status === ServiceStatusNumber.Expired || Date.now() >= job.expiresAt);
  const canEdit = !!job && !isExpired;
  const canRestart = !!job && !isExpired;
  const baseUrl = serviceBaseUrl(job);
  const primaryModelName = models[0]?.params?.servedModelName || models[0]?.model.id || 'model';

  /**
   * Edit → back to the model-selection step with the whole selection preselected on the query.
   * The `edit` flag makes the flow skip env selection & payment (same env, no re-pay) — see payment-page.
   */
  const onEdit = () => {
    // Relaunch would be rejected by the node once expired — the button is disabled then, but guard
    // the handler too so a stale render can't fire it.
    if (!canEdit) {
      return;
    }
    router.push({
      pathname: '/inference/custom-models',
      query: { ...buildSelectionQuery(), edit: '1', serviceId: id },
    });
  };

  /**
   * The local countdown hitting zero is only an estimate — the node's expiry cron flips the status
   * asynchronously. Bump pollEpoch to re-kick the loop for an immediate status re-check (instead of
   * waiting up to POLL_INTERVAL_MS) so the page tracks Running → Expired promptly.
   */
  const onLocalExpiry = useCallback(() => {
    setPollEpoch((epoch) => epoch + 1);
  }, []);

  /**
   * Prolong → straight to payment for the extra runtime only.
   * Same selection (env/token/gpu/models), duration overridden to the chosen extra time;
   * the `prolong` flag skips the earlier steps and reuses the same price formula. See payment-page.
   */
  const onProlong = (extraSeconds: number) => {
    // The prolong payment page needs the token in the query to rehydrate on a hard reload; it's
    // seeded from the running job, so wait until that's in before navigating (button is also gated).
    if (!selectedToken) {
      setJobError('Loading service details — try again in a moment.');
      return;
    }
    setProlongOpen(false);
    // Provider persists across client-side nav, so URL hydration won't re-run on the payment page —
    // push the chosen duration straight into context (the query keeps it for a hard reload).
    setJobDurationSeconds(extraSeconds);
    router.push({
      pathname: '/inference/custom-models/payment',
      query: { ...buildSelectionQuery(), duration: String(extraSeconds), prolong: '1', serviceId: id },
    });
  };

  // Plain-text version for the copy button — the on-screen block is syntax-highlighted JSX.
  const chatUrl = baseUrl ? `${baseUrl}/v1/chat/completions` : '$BASE/v1/chat/completions';
  const curlSnippet = `curl ${chatUrl} \\
  -H "Content-Type: application/json" \\
  -d '{ "model": "${primaryModelName}", "messages": [ { "role": "user", "content": "Hello!" } ] }'`;

  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Manage Service" subTitle="Usage, environment & how to call your endpoint" />

      {/* Failed URL hydration means no node/env to poll — show the retry instead of an eternal spinner. */}
      {hydrationFailed ? (
        <div className="pageContentWrapper">
          <InferenceHydrationError />
        </div>
      ) : (
        <div className="pageContentWrapper">
          {/* Header */}
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="lg" variant="glass-shaded">
            <div className={styles.header}>
              <div>
                <h3>{serviceName}</h3>
                <div className={styles.meta}>Custom selection</div>
              </div>
              <span className={cx('chip', styles.statusChip, styles[`status_${status.kind}`])}>
                {status.kind === 'pending' ? <CircularProgress size={12} /> : <span className={styles.statusDot} />}
                {status.label}
              </span>
            </div>

            {jobError && <div className="textAccent1">{jobError}</div>}

            {/* Countdown only meaningful once the service is running with a known expiry. */}
            {isRunning && (
              <DurationProgress
                elapsedSeconds={durationElapsedSeconds}
                onExpired={onLocalExpiry}
                totalSeconds={durationTotalSeconds}
              />
            )}

            <div className="actionsGroupMdBetween">
              <div className="actionsGroupMdEnd">
                <Button
                  color="accent1"
                  contentBefore={<RestartAltIcon />}
                  disabled={!canRestart || actionLoading !== null}
                  loading={actionLoading === 'restart'}
                  onClick={() => runServiceAction('restart')}
                  size="md"
                  variant="outlined"
                >
                  Restart
                </Button>
              </div>
              <div className="actionsGroupMdEnd">
                <Button
                  color="accent1"
                  contentBefore={<EditOutlinedIcon />}
                  disabled={!canEdit}
                  onClick={onEdit}
                  size="md"
                  variant="outlined"
                >
                  Edit
                </Button>
                <Button
                  color="accent1"
                  contentBefore={<BoltOutlinedIcon />}
                  disabled={!job || !selectedToken}
                  onClick={() => setProlongOpen(true)}
                  size="md"
                  variant="filled"
                >
                  Prolong session
                </Button>
              </div>
            </div>
          </Card>

          {/* Models */}
          {models.length > 0 && (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <div className={styles.howToHead}>
                <h3>Model</h3>
                <span className="textSecondary">Expand for launch parameters</span>
              </div>
              <InferenceModelList models={models} />
            </Card>
          )}

          {/* Environment */}
          {environment && nodeInfo && (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <div className={styles.howToHead}>
                <h3>Environment</h3>
                <span className="textSecondary">Running for {formatDuration(durationTotalSeconds)}</span>
              </div>
              <InferenceEnvironmentCard
                defaultToken={defaultToken}
                durationSeconds={durationTotalSeconds}
                environment={environment}
                gpuSelection={gpuSelection}
                nodeInfo={nodeInfo}
              />
            </Card>
          )}

          {/* How to use — hidden once expired: the endpoint is torn down even if the status still
              reads Running (expiry-cron lag), so a callable URL there would be misleading. */}
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <div className={styles.howToHead}>
              <h3>How to use</h3>
              {baseUrl && !isExpired ? (
                // vLLM runs on FastAPI, which serves interactive Swagger docs at /docs — the live,
                // model-accurate source of truth for every route this container exposes.
                <a className={styles.docsLink} href={`${baseUrl}/docs`} rel="noreferrer" target="_blank">
                  Service API docs
                  <OpenInNewIcon fontSize="inherit" />
                </a>
              ) : null}
            </div>

            {baseUrl && !isExpired ? (
              <>
                <div className={styles.endpoints}>
                  <Card className={styles.endpoint} innerShadow="black" padding="xs" radius="lg" variant="glass">
                    <div className="chip chipGlass">Base URL</div>
                    <span className={styles.endpointPath}>{baseUrl}</span>
                    <span className={styles.endpointDescription}></span>
                    <CopyButton color="accent2" contentToCopy={baseUrl} variant="filled" />
                  </Card>

                  {ENDPOINTS.map((endpoint) => (
                    <Card
                      className={styles.endpoint}
                      innerShadow="black"
                      key={`${endpoint.method}-${endpoint.path}`}
                      padding="xs"
                      radius="lg"
                      variant="glass"
                    >
                      <span className={cx('chip', endpoint.method === 'GET' ? 'chipAccent2' : 'chipAccent1')}>
                        {endpoint.method}
                      </span>
                      <span className={styles.endpointPath}>{endpoint.path}</span>
                      <span className={styles.endpointDescription}>{endpoint.description}</span>
                      <CopyButton color="accent2" contentToCopy={`${baseUrl}${endpoint.path}`} variant="filled" />
                    </Card>
                  ))}
                </div>
                <div className={styles.quickTestHead}>
                  <h4>Quick test</h4>
                  <CopyButton color="accent2" contentToCopy={curlSnippet} variant="filled" />
                </div>
                <pre className={styles.terminal}>{curlSnippet}</pre>
              </>
            ) : (
              <div className="textSecondary">
                {isExpired
                  ? 'This session has ended — the endpoints are no longer available.'
                  : isRunning
                    ? 'Service is running but exposed no endpoint.'
                    : 'Endpoints become available once the service is running…'}
              </div>
            )}
          </Card>

          {/* Logs — container stdout/stderr; the crash reason when a container exits unexpectedly. */}
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <h3>Logs</h3>
            {logsOpen ? (
              <ServiceLogsPanel
                consumerAddress={account.address ?? undefined}
                nodePeerId={nodePeerId}
                nodeUri={nodeUri}
                open={logsOpen}
                serviceId={id}
              />
            ) : (
              <div className="actionsGroupMdEnd">
                <Button color="accent1" onClick={() => setLogsOpen(true)} size="md" variant="outlined">
                  Show logs
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      <ProlongSessionModal isOpen={prolongOpen} onClose={() => setProlongOpen(false)} onConfirm={onProlong} />
    </Container>
  );
};

export default ManageServicePage;
