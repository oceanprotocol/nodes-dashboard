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
import { withTimeout } from '@/lib/with-timeout';
import { getModelShortName } from '@/services/huggingface-service';
import {
  detectEngine,
  enginePort,
  parseEngineCommand,
  parseServiceResources,
  toNodeUri,
} from '@/services/inference-launch';
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

/**
 * Prefer the endpoint on the engine's OpenAI-compatible port (vLLM 8000, llama.cpp 8080), detected
 * from the running service's dockerCmd; fall back to the first exposed endpoint.
 */
function serviceBaseUrl(job: ServiceJob | null): string | null {
  if (!job || job.endpoints.length === 0) {
    return null;
  }
  const port = enginePort(job.dockerCmd ? detectEngine(job.dockerCmd) : 'vllm');
  const match = job.endpoints.find((ep) => ep.containerPort === port);
  return (match ?? job.endpoints[0]).url;
}

// How often to poll the node for the service status while it's still spinning up.
const POLL_INTERVAL_MS = 4000;
// A P2P round-trip can hang indefinitely if the node/relay is unreachable (no built-in timeout).
// Cap each status fetch so a hung dial surfaces as an error + retry instead of an eternal spinner.
const STATUS_TIMEOUT_MS = 30000;

/**
 * Statuses that stop the poll loop — genuinely final states. `Running` is deliberately NOT here: a
 * running service can still crash (→ Error/Stopped) or expire (→ Expired), so we keep polling.
 */
const TERMINAL_STATUSES = new Set<ServiceStatusNumber>([
  ServiceStatusNumber.PullImageFailed,
  ServiceStatusNumber.BuildImageFailed,
  ServiceStatusNumber.VulnerableImage,
  ServiceStatusNumber.Stopped,
  ServiceStatusNumber.Expired,
  ServiceStatusNumber.Error,
]);

/**
 * Statuses the node's SERVICE_EXTEND accepts — mirrors ocean-node `extendService.ts`, which rejects
 * anything else with 400 "Only Starting or Running services can be extended". Deliberately excludes
 * the mid-startup statuses the node itself sets (Locking/PullImage/BuildImage/Claiming) and Restarting:
 * they're rejected too, so offering Prolong there would take the user to payment for a doomed call.
 */
const PROLONGABLE_STATUSES = new Set<ServiceStatusNumber>([ServiceStatusNumber.Starting, ServiceStatusNumber.Running]);

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

  // Authoritative elapsed (parent recomputes from wall-clock each poll). In a ref so the interval can
  // resync WITHOUT re-arming — depending on elapsedSeconds would rebuild the timer every poll and drop
  // sub-poll ticks. Synced in an effect (not during render) to stay concurrent-safe.
  const elapsedSecondsRef = useRef(elapsedSeconds);
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  // Advance 1s/tick, clamped up to the authoritative value: the interval free-runs and falls behind
  // while backgrounded (browsers throttle setInterval to ~1/min), so clamping corrects it on refocus.
  // Never rewind — the local tick can be a hair ahead of the last poll.
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => Math.min(Math.max(prev + 1, elapsedSecondsRef.current), totalSeconds));
    }, 1000);
    return () => clearInterval(timer);
  }, [totalSeconds]);

  const remaining = Math.max(0, totalSeconds - elapsed);
  const percent = totalSeconds > 0 ? Math.min(100, (elapsed / totalSeconds) * 100) : 0;
  const expired = remaining <= 0;

  // Local countdown hitting zero is only an estimate — tell the parent to re-check the real status.
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

  // The real service job, polled from the node until terminal.
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'restart' | null>(null);
  // Bumped after restart to re-kick the poll loop.
  const [pollEpoch, setPollEpoch] = useState(0);
  const [logsOpen, setLogsOpen] = useState(false);

  const nodeUri = useMemo(() => (selectedEnv ? toNodeUri(selectedEnv.nodeInfo) : null), [selectedEnv]);
  const nodePeerId = selectedEnv?.nodeInfo.id;

  /** Fetch the service status once; returns true when terminal (stop polling). */
  const fetchStatus = useCallback(async (): Promise<boolean> => {
    if (!nodeUri || !nodePeerId || !account.address || !id) {
      return false;
    }
    try {
      // Reuse the node's cached auth token so the poll doesn't mint one per tick — concurrent token
      // creation collides on the node's per-address nonce. withNodeAuth re-mints once on a 401.
      const jobs = await withNodeAuth(nodePeerId, nodeUri, (token) =>
        withTimeout((signal) => getServiceStatus(nodeUri, token, id, signal), STATUS_TIMEOUT_MS, 'Service status')
      );
      const found = jobs.find((j) => j.serviceId === id) ?? jobs[0] ?? null;
      setJob(found);
      setJobError(null);
      setJobLoading(false);
      return !!found && TERMINAL_STATUSES.has(found.status);
    } catch (error) {
      console.error('Failed to fetch service status:', error);
      setJobError(error instanceof Error ? error.message : 'Failed to load service status.');
      setJobLoading(false);
      return false; // keep polling — transient network errors shouldn't stop the watch
    }
  }, [nodeUri, nodePeerId, account.address, id, withNodeAuth, getServiceStatus]);

  // Poll until terminal. Wait for hydration so nodeUri is available.
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

  // Seed the payment token from the running job when the URL-hydrated selection didn't carry one (e.g.
  // token-symbol lookup failed during hydration). Authoritative token the service started with, so an
  // Edit relaunch reuses it instead of tripping the "missing payment token" guard on payment.
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

  // What the container is ACTUALLY running, straight off the node's own job record (polled over P2P) —
  // authoritative and fresher than the URL-hydrated selection, which is whatever the link carried.
  const jobCommand = useMemo(() => (job?.dockerCmd ? parseEngineCommand(job.dockerCmd) : null), [job?.dockerCmd]);

  // Seed model launch params from the job's dockerCmd when the URL didn't carry them (e.g. opened from
  // the services table, which only puts models/env/duration on the query). Keeps the Model card and
  // prolong summary from rendering N/A, and gives an Edit relaunch its params. Only fills a model that
  // has none yet — a full config committed earlier in-flow always wins.
  useEffect(() => {
    if (!jobCommand || selectedModels.length === 0) {
      return;
    }
    const target = jobCommand.modelId ? selectedModels.find((m) => m.id === jobCommand.modelId) : selectedModels[0];
    if (!target || modelParamsByModel[target.id]) {
      return;
    }
    setParamsForModel(target.id, jobCommand.params);
  }, [jobCommand, selectedModels, modelParamsByModel, setParamsForModel]);

  /** Restart the container in place, then re-kick the poll to track Running → Starting → Running. */
  const runServiceAction = useCallback(
    async (action: 'restart') => {
      if (!nodeUri || !nodePeerId || !account.address || !id) {
        return;
      }
      setActionLoading(action);
      setJobError(null);
      try {
        // Same cached token as the poll loop — avoids a concurrent createAuthToken (nonce clash).
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

  /**
   * Which model this page shows, in order of authority:
   *   1. the P2P job record's `--model` — what the container is actually running. Wins because an Edit
   *      relaunch swaps the model in place (serviceRestart + dockerCmd, same serviceId), so the link
   *      that got us here can name a model this service no longer serves.
   *   2. the backend session record's model, which reaches us as the `models` query param,
   *   3. neither → the card says "Unknown model".
   * When both name the same model, the hydrated entry is used: same id, but with HF metadata (avatar,
   * author) the job record doesn't carry. A node-only model renders off its id alone, with launch params
   * parsed from the same dockerCmd. One container serves one model, so it replaces the list, not joins.
   */
  const models: ServiceModel[] = useMemo(() => {
    const jobModelId = jobCommand?.modelId;
    if (jobModelId) {
      const hydrated = selectedModels.find((m) => m.id === jobModelId);
      return [{ model: hydrated ?? { id: jobModelId }, params: modelParamsByModel[jobModelId] ?? jobCommand.params }];
    }
    return selectedModels.map((model) => ({ model, params: modelParamsByModel[model.id] }));
  }, [selectedModels, modelParamsByModel, jobCommand]);

  const environment = selectedEnv?.environment ?? null;
  const nodeInfo = selectedEnv?.nodeInfo ?? null;

  // Resources the service ACTUALLY holds, from the node's own job record — authoritative, and the only
  // source when the service was opened from the services table (whose Manage link carries no
  // `gpus`/`res` params, leaving the hydrated selection to re-derive a whole-env slice that has nothing
  // to do with what was booked). Falls back to the hydrated selection when the job record is unusable.
  const bookedResources = useMemo(
    () => (job && environment ? parseServiceResources(environment.resources ?? [], job.resources) : null),
    [job, environment]
  );
  const gpuSelection = bookedResources?.gpuSelection ?? selectedEnv?.gpuSelection;
  const sizing = bookedResources?.sizing ?? selectedEnv?.sizing;
  // Nothing to size the environment card with yet: arrived from the services table (no `gpus`/`res` on
  // the query) and the node's job record hasn't landed. Rendering the card now would show a whole-env
  // allocation and price that aren't what the service holds, so wait out the first poll instead.
  const awaitingBookedResources = !job && !sizing && Object.keys(gpuSelection ?? {}).length === 0;
  /**
   * What the flow steps an Edit / Prolong re-enters must be told, carried on the query — the running
   * service's own facts, not the context selection this page never rewrites.
   *
   * Resources: without them the config step would ceiling tensor-parallelism at the wrong GPU count and
   * a prolong would price (and escrow) the extra runtime off a whole-env slice instead of what the
   * service holds. Model: the P2P-resolved one (with its launch params, parsed from the same dockerCmd)
   * whenever it isn't already the context selection — otherwise an Edit would relaunch the model the
   * link happened to name rather than the one actually running.
   */
  const selectionOverrides = useMemo(() => {
    const nodeOnlyModel = models.find((entry) => !selectedModels.some((m) => m.id === entry.model.id));
    return {
      ...(bookedResources ? { gpuSelection: bookedResources.gpuSelection, sizing: bookedResources.sizing } : {}),
      ...(nodeOnlyModel
        ? {
            models: [nodeOnlyModel.model],
            ...(nodeOnlyModel.params
              ? {
                  modelParamsByModel: { [nodeOnlyModel.model.id]: nodeOnlyModel.params },
                  engine: nodeOnlyModel.params.engine,
                }
              : {}),
          }
        : {}),
    };
  }, [models, selectedModels, bookedResources]);
  const nowSeconds = Math.floor(Date.now() / 1000);
  // Derive total + elapsed from the job's own start (dateCreated) and expiry, so both track the ACTUAL
  // window — including after a Prolong, which pushes expiresAt forward while leaving job.duration at the
  // original paid value (using that would make the bar wrong post-extend). Fall back to the requested
  // duration only before the job loads. `expiresAt` is ms; `dateCreated` is an ISO timestamp.
  const jobStartSeconds = job ? Math.floor(new Date(job.dateCreated).getTime() / 1000) : 0;
  const jobExpirySeconds = job ? Math.floor(job.expiresAt / 1000) : 0;
  const durationTotalSeconds =
    job && Number.isFinite(jobStartSeconds) && jobExpirySeconds > jobStartSeconds
      ? jobExpirySeconds - jobStartSeconds
      : jobDurationSeconds;
  const durationElapsedSeconds = job ? Math.max(0, Math.min(durationTotalSeconds, nowSeconds - jobStartSeconds)) : 0;
  const defaultToken = selectedToken?.address;
  // Named after whichever model won in `models`; the raw serviceId when there's no model at all.
  const serviceName = models.length > 0 ? models.map((m) => getModelShortName(m.model.id)).join(' + ') : id;

  const status = job
    ? getServiceStatusView(job.status, job.statusText)
    : { kind: 'pending' as const, label: jobLoading ? 'Loading…' : 'Unknown' };
  const isRunning = job?.status === ServiceStatusNumber.Running;
  // The node refuses serviceRestart once the paid window is up — rejecting both the Expired status AND
  // any job past expiresAt (the expiry cron flips status asynchronously, so a service can be past
  // expiresAt while still reading Running). Mirror it so Edit/Restart aren't offered when doomed to
  // fail. `expiresAt` is ms.
  const isExpired = !!job && (job.status === ServiceStatusNumber.Expired || Date.now() >= job.expiresAt);
  const canEdit = !!job && !isExpired;
  const canRestart = !!job && !isExpired;
  // Mirror the node's SERVICE_EXTEND gate (Starting/Running only), plus our own expiry check: extend
  // does `expiresAt += additionalDuration` with no past-expiry guard of its own, so a service still
  // reading Running while past expiresAt (expiry-cron lag) would charge the user and land on a new
  // expiresAt that is still in the past — paying for zero runtime.
  const canProlong = !!job && !isExpired && !!selectedToken && PROLONGABLE_STATUSES.has(job.status);
  const baseUrl = serviceBaseUrl(job);
  const primaryModelName = models[0]?.params?.servedModelName || models[0]?.model.id || 'model';

  /**
   * Edit → back to model-selection with the whole selection on the query. The `edit` flag skips env
   * selection & payment (same env, no re-pay) — see payment-page.
   */
  const onEdit = () => {
    // Node rejects relaunch once expired — button is disabled, but guard so a stale render can't fire.
    if (!canEdit) {
      return;
    }
    router.push({
      pathname: '/inference/custom-models',
      query: { ...buildSelectionQuery(selectionOverrides), edit: '1', serviceId: id },
    });
  };

  // Local countdown hitting zero is only an estimate — bump pollEpoch for an immediate status re-check
  // (vs. waiting up to POLL_INTERVAL_MS) so Running → Expired is tracked promptly.
  const onLocalExpiry = useCallback(() => {
    setPollEpoch((epoch) => epoch + 1);
  }, []);

  /**
   * Prolong → straight to payment for the extra runtime only. Same selection (env/token/gpu/models),
   * duration overridden to the extra time; the `prolong` flag skips earlier steps and reuses the same
   * price formula. See payment-page.
   */
  const onProlong = (extraSeconds: number) => {
    // Button is gated on the same flag, but guard so a stale render (or a status flip while the modal is
    // open) can't send an expired/dead service to payment. The token half of canProlong is seeded from
    // the running job, hence the separate "still loading" message.
    if (!canProlong) {
      // Close the modal too — the error renders in the page header, hidden behind an open modal.
      setProlongOpen(false);
      setJobError(
        selectedToken ? 'This service can no longer be extended.' : 'Loading service details — try again in a moment.'
      );
      return;
    }
    setProlongOpen(false);
    // Provider persists across client-side nav, so URL hydration won't re-run — push duration straight
    // into context (query keeps it for a hard reload).
    setJobDurationSeconds(extraSeconds);
    router.push({
      pathname: '/inference/custom-models/payment',
      query: {
        ...buildSelectionQuery(selectionOverrides),
        duration: String(extraSeconds),
        prolong: '1',
        serviceId: id,
      },
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

            {/* Countdown tracks the PAID window, not the container's health — a crashed (Error/Stopped)
                service still holds its slot until expiresAt, and Restart/Prolong stay available until
                then, so keep the bar up alongside the status chip. Only hidden once actually expired. */}
            {job && !isExpired && durationTotalSeconds > 0 && (
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
                  disabled={!canProlong}
                  onClick={() => setProlongOpen(true)}
                  size="md"
                  variant="filled"
                >
                  Prolong session
                </Button>
              </div>
            </div>
          </Card>

          {/* Model. Rendered even when there's no model to name: the card is the only place the model
              appears, so "unknown" must be stated rather than the card silently vanishing — otherwise
              the previous service's card is the last thing the user saw here. */}
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <div className={styles.howToHead}>
              <h3>Model</h3>
              {models.length > 0 && <span className="textSecondary">Expand for launch parameters</span>}
            </div>
            {models.length > 0 ? (
              <InferenceModelList models={models} />
            ) : (
              <div className="textSecondary">
                {jobLoading
                  ? 'Loading model…'
                  : 'Unknown model — neither the node nor this service’s record names one.'}
              </div>
            )}
          </Card>

          {/* Environment */}
          {environment && nodeInfo && (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <div className={styles.howToHead}>
                <h3>Environment</h3>
                <span className="textSecondary">Running for {formatDuration(durationTotalSeconds)}</span>
              </div>
              {awaitingBookedResources ? (
                <div className="textSecondary">Loading booked resources…</div>
              ) : (
                <InferenceEnvironmentCard
                  defaultToken={defaultToken}
                  durationSeconds={durationTotalSeconds}
                  environment={environment}
                  gpuSelection={gpuSelection}
                  nodeInfo={nodeInfo}
                  sizing={sizing}
                />
              )}
            </Card>
          )}

          {/* How to use — hidden once expired: the endpoint is torn down even if the status still
              reads Running (expiry-cron lag), so a callable URL there would be misleading. */}
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <div className={styles.howToHead}>
              <h3>How to use</h3>
              {baseUrl && !isExpired ? (
                // vLLM (FastAPI) serves interactive Swagger docs at /docs — live source of truth for
                // every route this container exposes.
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
