import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useJobTemplate from '@/components/hooks/use-job-template';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import InferenceHydrationError from '@/components/inference/inference-hydration-error';
import InferenceModelList, { ServiceModel } from '@/components/inference/inference-model-list';
import ProlongSessionModal from '@/components/inference/prolong-session-modal';
import ProvisioningProgress from '@/components/inference/provisioning-progress';
import ServiceLogsPanel from '@/components/inference/service-logs-panel';
import SessionAlertsToggle from '@/components/inference/session-alerts-toggle';
import TemplateSummary from '@/components/inference/template-summary';
import ProgressBar from '@/components/progress-bar/progress-bar';
import ResourceUsagePanel from '@/components/resource-usage/resource-usage-panel';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { useNodeTokensContext } from '@/context/node-tokens';
import { useP2P } from '@/contexts/P2PContext';
import { useMetricsHistory } from '@/hooks/use-metrics-history';
import { captureError } from '@/lib/analytics';
import { getTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { withTimeout } from '@/lib/with-timeout';
import { decodeModelIds, getModelShortName } from '@/services/huggingface-service';
import {
  detectEngine,
  enginePort,
  parseEngineCommand,
  parseServiceResources,
  toNodeUri,
} from '@/services/inference-launch';
import { firstQueryValue } from '@/services/inference-url';
import { getServiceStatusView, isPaymentInFlight, isProlongBlocked, isRestartBlocked } from '@/services/service-status';
import { rememberSession } from '@/services/session-expiry';
import { deepLinkWorkflow, templateOpenUrl, templatePrimaryPort } from '@/services/template-launch';
import { getRuntimeMetrics } from '@/types/runtime-metrics';
import { isBundle } from '@/types/templates';
import { formatDuration, formatHMS } from '@/utils/formatters';
import { resourceDescriptionsById } from '@/utils/resources';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { CircularProgress } from '@mui/material';
import { ServiceJob, ServiceStatusNumber } from '@oceanprotocol/lib';
import cx from 'classnames';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './manage-service-page.module.css';

/**
 * Generic OpenAI API reference. Always reachable, never service-specific — the request/response shape
 * for the OpenAI-compatible surface both engines we launch expose.
 */
const OPENAI_API_SPEC_URL = 'https://platform.openai.com/docs/api-reference/chat';

/**
 * The container's own interactive spec, when the engine serves one: vLLM is FastAPI, so it publishes
 * Swagger at /docs; llama.cpp's server publishes nothing. Null means "offer only the generic reference".
 *
 * Whether the URL actually answers can't be verified from here — /docs is cross-origin and vLLM ships
 * no CORS headers by default, so a probe fails identically whether the route is missing or merely
 * unreadable. Hence the pairing below: this link is the specific one, and the OpenAI reference stands
 * beside it permanently rather than as a fallback we'd have to detect our way into.
 */
function serviceDocsUrl(job: ServiceJob | null, baseUrl: string | null): string | null {
  if (!baseUrl || !job) {
    return null;
  }
  const engine = job.dockerCmd ? detectEngine(job.dockerCmd) : 'vllm';
  return engine === 'vllm' ? `${baseUrl}/docs` : null;
}

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
// `sizing`'s ram/disk are GB (decimal-named, binary-sized to match formatBytes' 1024 base) — convert
// to bytes for the resource usage card's booked-allocation fallback.
const GIB = 1024 ** 3;

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
    selectedTemplate,
    setSelectedTemplate,
    jobDurationSeconds,
    setJobDurationSeconds,
    hydrateFromUrlFinished,
    hydrationFailed,
    buildSelectionQuery,
  } = useInferenceContext();
  const { account } = useOceanAccount();
  const { getServiceStatus, serviceRestart } = useP2P();
  const { withNodeAuth } = useNodeTokensContext();

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

  // Poll dedupe: fetchStatus runs every POLL_INTERVAL_MS, so both the status-changed and
  // status-failed events need a "last seen" ref rather than firing per tick. Reset on `id`
  // change so navigating between services doesn't suppress the first event of a new run.
  const lastReportedStatusRef = useRef<ServiceStatusNumber | null>(null);
  const lastStatusFailedRef = useRef(false);
  useEffect(() => {
    lastReportedStatusRef.current = null;
    lastStatusFailedRef.current = false;
  }, [id]);

  /**
   * What the link itself says this service is — read straight off the query rather than the hydrated
   * context, so it's known on the first render instead of after the async model/template restore.
   *
   * `models=` with no `template=` claims a custom-model launch. It is a strong claim but NOT a final
   * one, because it is generated from a record that cannot tell the two apart: several node templates
   * pin their model with `--model` / `-hf` in the command (vllm-qwen-0-5b, vllm-nomic-embed,
   * llamacpp-phi4-cpu), the incentive-backend derives a session's `model` from exactly that flag, and
   * the services table then skips template matching for any session that has one — so a plain SERVICE
   * launch of those templates gets a `models=` link and would be managed, edited and prolonged as if
   * the user had brought the model themselves. Nothing in the stack records which template a service
   * came from (neither the backend record nor the node's own ServiceJob), so only the running command
   * can settle it — see `template` below, where a unique image+command match outranks this claim.
   *
   * It still stands on its own wherever the command DOESN'T uniquely name a template: a custom launch
   * runs the same image the node's inference templates do, so image alone would resolve every model
   * service to one of them, drop the Model card, the base URL and the curl example, and offer an
   * "Open UI" button for a web UI an inference server doesn't serve.
   */
  const isModelServiceByUrl = !firstQueryValue(router.query.template) && decodeModelIds(router.query.models).length > 0;
  // The template this service was launched from, matched off the node's own job record (see
  // useJobTemplate). Matched even when the URL named one, because the link is only as good as whatever
  // matched it: the services table matches against a listing that drops dockerCmd, which can't tell a
  // bundle from the service it shares an image with. The Model card waits the match out rather than
  // flashing "Unknown model" at an app service for the half-second before the catalogue lands.
  const {
    template: jobTemplate,
    matching: matchingTemplate,
    exact: jobTemplateExact,
    settled: templateSettled,
    failed: templateMatchFailed,
  } = useJobTemplate(job);
  /**
   * Which template this service runs, in order of authority:
   *   1. an EXACT job match — image plus a command only ONE template in the catalogue has. That is the
   *      running container identifying itself, so it outranks everything, including a `models=` link
   *      that claims a custom launch (see isModelServiceByUrl: those links are generated for real
   *      service launches too, and following them sent an Edit into the model picker every time).
   *   2. the URL's claim of a custom-model launch — no unique command said otherwise, so a service
   *      that names a model is taken at its word rather than image-matched onto a template it merely
   *      shares an image with.
   *   3. the template the link named (the in-flow selection an Edit re-entry is built from),
   *   4. an inexact (image-only) job match, when the link named none.
   *
   * Case 2 is deliberately NOT weakened to "unless the job matched something", which was tried and
   * reverted after browser testing. Every custom-model launch runs the inference templates' own image
   * (that is what serves the model), so an image-only match resolves one to a template every time: a
   * plain TinyLlama launch came back labelled "vLLM — any Hugging Face model", showed a Service card
   * instead of its Model card, lost Edit, and would have prolonged through the template payment page.
   * Only a UNIQUE command — case 1 — can outrank the link, because only that identifies the variant.
   *
   * The one thing this cannot resolve is a custom launch whose command is byte-for-byte a template's —
   * same model, same defaults, no extra flags. Nothing in the record distinguishes those two, so it is
   * read as the template: the container is identical either way, so an Edit relaunches the same thing,
   * and a user who wants different params can launch a new service. Preferring the other reading is
   * what broke every real service launch, which is not a trade worth making for the rarer case.
   */
  const template =
    (jobTemplateExact ? jobTemplate : null) ?? (isModelServiceByUrl ? null : (selectedTemplate ?? jobTemplate));
  const isBundleService = !!template && isBundle(template);
  /**
   * Publish the resolved template to context.
   *
   * This page is the only place that knows which template a running service belongs to when the link
   * didn't say — it matches off the node's own job record. Every step page an Edit / Prolong re-entry
   * lands on, however, tests CONTEXT's `selectedTemplate` in its bounce guard, and the manage link
   * carries no `template=` for a bundle (the services table withholds it on an ambiguous match, which
   * every bundle is: the backend listing drops `dockerCmd`, so it can only ever match by an image its
   * variants share). Left unpublished, the re-entry navigated to the right URL and was bounced back
   * out of the flow the moment it arrived.
   */
  useEffect(() => {
    if (template && template.id !== selectedTemplate?.id) {
      setSelectedTemplate(template);
    }
  }, [template, selectedTemplate?.id, setSelectedTemplate]);
  // Which of the four entry branches this service belongs to, for PostHog funnels — see
  // resolveInferenceBranch. A managed service can't tell a custom launch from a quickstart one after
  // the fact (both are plain model services with no template), so both report 'custom' here; this is
  // a known, accepted limitation of reading branch off the running service rather than live flow state.
  // An ambiguously-matched bundle is a second such case: the match resolves to the bare SERVICE its
  // family shares, so `isBundleService` is false and this reports 'service' for a running bundle.
  const branch = !template ? 'custom' : isBundleService ? 'template' : 'service';

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
      lastStatusFailedRef.current = false;
      if (found && found.status !== lastReportedStatusRef.current) {
        const previousStatus = lastReportedStatusRef.current;
        lastReportedStatusRef.current = found.status;
        posthog.capture('inference_service_status_changed', {
          serviceId: id,
          status: found.status,
          previousStatus,
          nodeId: nodePeerId,
          isTerminal: TERMINAL_STATUSES.has(found.status),
          branch,
        });
      }
      return !!found && TERMINAL_STATUSES.has(found.status);
    } catch (error) {
      console.error('Failed to fetch service status:', error);
      setJobError(error instanceof Error ? error.message : 'Failed to load service status.');
      setJobLoading(false);
      // Only the first failure in a run of consecutive failures is reported — the poll retries
      // every tick, so every failure would otherwise double-count.
      if (!lastStatusFailedRef.current) {
        lastStatusFailedRef.current = true;
        captureError('inference_service_status_failed', error, { stage: 'status_poll', service_id: id, branch });
      }
      return false; // keep polling — transient network errors shouldn't stop the watch
    }
  }, [nodeUri, nodePeerId, account.address, id, withNodeAuth, getServiceStatus, branch]);

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
        posthog.capture('inference_service_restarted', { serviceId: id, nodeId: nodePeerId, branch });
      } catch (error) {
        console.error(`Failed to ${action} service:`, error);
        setJobError(error instanceof Error ? error.message : `Failed to ${action} service.`);
        captureError('inference_service_restart_failed', error, { stage: 'node_call', service_id: id, branch });
      } finally {
        setActionLoading(null);
      }
    },
    [nodeUri, nodePeerId, account.address, id, withNodeAuth, serviceRestart, branch]
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
   *
   * Empty for a template app: it serves no model, and its dockerCmd is the template's own command —
   * a `--model`-looking flag in there is the app's argument, not an HF model to name or relaunch.
   */
  const models: ServiceModel[] = useMemo(() => {
    if (template) {
      return [];
    }
    const jobModelId = jobCommand?.modelId;
    if (jobModelId) {
      const hydrated = selectedModels.find((m) => m.id === jobModelId);
      return [{ model: hydrated ?? { id: jobModelId }, params: modelParamsByModel[jobModelId] ?? jobCommand.params }];
    }
    return selectedModels.map((model) => ({ model, params: modelParamsByModel[model.id] }));
  }, [selectedModels, modelParamsByModel, jobCommand, template]);

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

  // Runtime metrics ride free on the same poll — SERVICE_GET_STATUS attaches them by default, so no
  // extra request and no flag. Reader degrades to null on a node with metrics disabled; a ring buffer
  // (reset when the serviceId changes) backs the gauges' peak ticks and the sparkline.
  const metrics = useMemo(() => getRuntimeMetrics(job), [job]);
  const metricsHistory = useMetricsHistory(metrics, id);
  // `sizing` amounts are display units (CPU cores, RAM/disk GB — see parseServiceResources) so a
  // gauge still has a denominator when the snapshot's own field is empty (unconstrained CPU, no
  // disk quota reported).
  const bookedForUsagePanel = sizing
    ? { cpuCores: sizing.cpu, ramBytes: sizing.ram * GIB, diskBytes: sizing.disk * GIB }
    : undefined;
  // The snapshot names resources by opaque id (`gpu2`, `cpu`); the environment knows the hardware
  // behind them, which is what the usage panel labels its gauges and GPU rows with.
  const hardwareNames = useMemo(() => resourceDescriptionsById(environment?.resources), [environment?.resources]);
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
      // Context's template is the link's, which may be missing (matched off the job record instead) or
      // simply wrong (matched from a listing with no dockerCmd). Without this an Edit / Prolong
      // re-entry would navigate to the template flow with no `template=` on the query and bounce
      // straight back out — or carry the wrong variant's id into the config it rebuilds.
      ...(template && template.id !== selectedTemplate?.id ? { templateId: template.id } : {}),
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
  }, [models, selectedModels, bookedResources, template, selectedTemplate]);
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
  // Runtime still ahead of the service — what an extension is added TO. Note the node caps
  // `remaining + additionalDuration`, NOT elapsed + additional: extending is bounded by the forward
  // window, so a long-running service is no harder to extend than a fresh one.
  const durationRemainingSeconds = Math.max(0, durationTotalSeconds - durationElapsedSeconds);
  /** Headroom for a single extension: the env's `maxJobDuration` minus the runtime already ahead of us. */
  const prolongMaxSeconds = environment?.maxJobDuration
    ? Math.max(0, environment.maxJobDuration - durationRemainingSeconds)
    : undefined;
  const defaultToken = selectedToken?.address;
  const isTemplate = !!template;
  // Edit relaunches the SAME bundle through serviceRestart, which recreates the container from the
  // image — service containers get no volume, so every relaunch re-downloads every bundled model on
  // the clock the user already paid for. Worth it to fix a wrong token; pure loss when there is
  // nothing to change, so a bundle that declares no configurable env vars doesn't offer Edit at all.
  const bundleHasConfig = (template?.userConfigurableEnvVars?.length ?? 0) > 0;
  // What the container actually runs, per the node's job record — outranks the template the link
  // names, which an Edit relaunch may have swapped away from. Null until the first poll lands.
  const runningImageRef = job ? (job.tag ? `${job.image}:${job.tag}` : job.image) : null;
  // A template app is named after the template; a model service after whichever model won in `models`
  // (the raw serviceId when there's no model at all).
  const serviceName = template
    ? (template.name ?? template.id)
    : models.length > 0
      ? models.map((m) => getModelShortName(m.model.id)).join(' + ')
      : id;
  // Template services serve a web UI (not an OpenAI API) — the URL on the template's primary port,
  // deep-linked to the installed workflow (see templateOpenUrl) so Open loads it, not a blank canvas.
  const templateUiUrl = useMemo(() => {
    if (!template || !job) {
      return null;
    }
    const port = templatePrimaryPort(template);
    const match = job.endpoints.find((ep) => ep.containerPort === port);
    const url = (match ?? job.endpoints[0])?.url;
    if (!url) {
      return null;
    }
    // Only a workflow template has a graph to deep-link to; this URL is also displayed as the
    // endpoint to copy, so a non-workflow app must get it unadorned.
    const workflow = deepLinkWorkflow(template.workflows);
    return workflow ? templateOpenUrl(url, workflow.id) : url;
  }, [template, job]);

  const status = job
    ? getServiceStatusView(job.status, job.statusText)
    : { kind: 'pending' as const, label: jobLoading ? 'Loading…' : 'Unknown' };
  const isRunning = job?.status === ServiceStatusNumber.Running;
  // The node refuses serviceRestart once the paid window is up — rejecting both the Expired status AND
  // any job past expiresAt (the expiry cron flips status asynchronously, so a service can be past
  // expiresAt while still reading Running). Mirror it so Edit/Restart aren't offered when doomed to
  // fail. `expiresAt` is ms.
  const isExpired = !!job && (job.status === ServiceStatusNumber.Expired || Date.now() >= job.expiresAt);
  // The statuses the node refuses a restart under — Expired, plus everything that holds its
  // per-service lifecycle lock (mid-start / restarting / stopping), which comes back as
  // "has a start/stop/restart operation in progress — retry shortly". See `isRestartBlocked`.
  const restartBlocked = isRestartBlocked(job?.status);
  // The node also refuses to restart a service whose payment was never claimed (escrow lock failed,
  // or it was refunded — `cancelTx` set): restarting would run it for free, so it says "start a new
  // service instead". claimTx is set before the first container start, so every legitimately
  // restartable job (Running / crashed Error / Stopped) has it.
  //
  // But it is NOT set yet while the initial payment is still settling (Locking / Claiming), and a job
  // sitting in those statuses has been paid for seconds ago — treating it as unpaid told a user who
  // had just paid that their payment "was never claimed" and to start a new service. Restart/Edit and
  // Prolong stay blocked through that window regardless, via isRestartBlocked / isProlongBlocked.
  const isUnpaid = !!job && !job.payment?.claimTx && !isPaymentInFlight(job.status);
  /**
   * Whether this service's template identity is known yet — `settled` covers "matched", "matched to
   * nothing" and "this is a model service, no match needed" alike.
   *
   * Edit and Prolong both branch on `template` to pick which flow they re-enter, and the match runs a
   * libp2p round trip AFTER the first status poll lands. Without this gate the buttons went live a
   * whole round trip early, and a click inside that window took the model-service branch for a
   * template service — landing on the model picker, which then cleared the selection.
   */
  const templateKnown = templateSettled;
  // Edit relaunches through the same SERVICE_RESTART (with a new dockerCmd), so it shares the gate.
  const canEdit =
    !!job && templateKnown && !isExpired && !restartBlocked && !isUnpaid && (!isBundleService || bundleHasConfig);
  const canRestart = !!job && !isExpired && !restartBlocked && !isUnpaid;
  // Prolong's own status gate (Expired / Locking / Claiming — see `isProlongBlocked`), plus our
  // expiry check: extend does `expiresAt += additionalDuration` with no past-expiry guard of its own,
  // so a service still reading Running while past expiresAt (expiry-cron lag) would charge the user
  // and land on a new expiresAt that is still in the past — paying for zero runtime.
  // Prolong prices the extra runtime off the resources the service HOLDS, which only `bookedResources`
  // (the node's own job record) can tell us when the page was opened from the services table — its
  // Manage link carries no `gpus`/`res`, so the hydrated selection is empty and would expand to a
  // whole-env slice at payment. Without a resource record there is nothing correct to price against,
  // so hold the action rather than quote (and escrow) every free GPU in the env.
  // `templateKnown` for the same reason as Edit: prolong routes to the template payment page or the
  // model one, and picking that branch before the match settles sends a template service to the model
  // picker instead of to payment.
  const canProlong =
    !!job && templateKnown && !isExpired && !isProlongBlocked(job.status) && !!selectedToken && !!bookedResources;
  const baseUrl = serviceBaseUrl(job);
  const docsUrl = serviceDocsUrl(job, baseUrl);
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
    // A template service re-enters the template flow at the config (reconfigure) step; a model service
    // re-enters the model picker. buildSelectionQuery already carries the template/model selection.
    if (template) {
      posthog.capture('inference_service_edit_clicked', {
        serviceId: id,
        templateId: template.id,
        isTemplate,
        isBundleService,
        branch,
      });
      router.push({
        pathname: `/inference/services/${encodeURIComponent(template.id)}/config`,
        query: { ...buildSelectionQuery(selectionOverrides), edit: '1', serviceId: id },
      });
      return;
    }
    posthog.capture('inference_service_edit_clicked', {
      serviceId: id,
      templateId: undefined,
      isTemplate,
      isBundleService,
      branch,
    });
    router.push({
      pathname: '/inference/custom-models',
      query: { ...buildSelectionQuery(selectionOverrides), edit: '1', serviceId: id },
    });
  };

  // Local countdown hitting zero is only an estimate — bump pollEpoch for an immediate status re-check
  // (vs. waiting up to POLL_INTERVAL_MS) so Running → Expired is tracked promptly.
  const onLocalExpiry = useCallback(() => {
    posthog.capture('inference_service_expired', { serviceId: id, durationTotalSeconds, branch });
    setPollEpoch((epoch) => epoch + 1);
  }, [id, durationTotalSeconds, branch]);

  // Record the node's authoritative expiry so the app-wide notifier can warn about this session from
  // any page (and after a reload, or in another tab). Deliberately its own effect rather than a line
  // inside fetchStatus: the fields it reads (serviceName, asPath) would join fetchStatus's dep list,
  // and fetchStatus is a dep of the poll effect — the 4s loop would re-arm on every rename. Depends
  // on the job's primitives, not the object, so a poll that changed nothing doesn't rewrite the store.
  const jobServiceId = job?.serviceId;
  const jobExpiresAt = job?.expiresAt;
  const jobStatus = job?.status;
  const jobDateCreated = job?.dateCreated;
  useEffect(() => {
    if (!jobServiceId || !jobExpiresAt || !account.address) {
      return;
    }
    const startedAt = new Date(jobDateCreated ?? '').getTime();
    if (!Number.isFinite(startedAt)) {
      return;
    }
    rememberSession(account.address, {
      serviceId: jobServiceId,
      expiresAt: jobExpiresAt,
      startedAt,
      status: jobStatus,
      label: serviceName,
      href: router.asPath,
    });
  }, [jobServiceId, jobExpiresAt, jobStatus, jobDateCreated, account.address, serviceName, router.asPath]);

  // Deep-linked from an expiry warning: land straight on the prolong modal. Waits for canProlong —
  // the payment token and booked resources are both seeded asynchronously from the polled job — and
  // fires once, so dismissing the modal doesn't reopen it on the next render.
  const autoProlongedRef = useRef(false);
  useEffect(() => {
    if (router.query.openProlong !== '1' || autoProlongedRef.current || !canProlong) {
      return;
    }
    autoProlongedRef.current = true;
    setProlongOpen(true);
  }, [router.query.openProlong, canProlong]);

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
        !selectedToken || !templateKnown
          ? 'Loading service details — try again in a moment.'
          : 'This service can no longer be extended.'
      );
      return;
    }
    setProlongOpen(false);
    // Provider persists across client-side nav, so URL hydration won't re-run — push duration straight
    // into context (query keeps it for a hard reload).
    setJobDurationSeconds(extraSeconds);
    const query = {
      ...buildSelectionQuery(selectionOverrides),
      duration: String(extraSeconds),
      prolong: '1',
      serviceId: id,
    };
    // A template service prolongs through the template payment page (flowType=Template); a plain model
    // service through the model one. `canProlong` waits for the template match to settle, so this is
    // the service's real identity, not a not-yet-known one.
    if (template) {
      router.push({
        pathname: `/inference/services/${encodeURIComponent(template.id)}/payment`,
        query,
      });
      return;
    }
    router.push({ pathname: '/inference/custom-models/payment', query });
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
                {/* Anything that isn't a template app is a model service — reached from the custom
                    picker OR from a curated package, and the package identity isn't carried this far,
                    so the label has to be true for both rather than claim a custom selection. */}
                <div className={styles.meta}>{isTemplate ? 'Template app' : 'Model service'}</div>
              </div>
              <span className={cx('chip', styles.statusChip, styles[`status_${status.kind}`])}>
                {status.kind === 'pending' ? <CircularProgress size={12} /> : <span className={styles.statusDot} />}
                {status.label}
              </span>
            </div>

            {jobError && <div className="textAccent1">{jobError}</div>}

            {/* Say WHY Restart/Edit are greyed out — a disabled button with no reason reads as a broken
                page. The status case clears itself on the next poll; unpaid never does. */}
            {job && !isExpired && (restartBlocked || isUnpaid) && (
              <div className="textSecondary">
                {isUnpaid
                  ? 'This service’s payment was never claimed (unpaid or refunded) — it can’t be restarted or edited. Start a new service instead.'
                  : `Service is ${status.label.toLowerCase()} — Restart and Edit become available once the node finishes this operation.`}
              </div>
            )}

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

            {/* Opt-in for an OS-level alert, so the warning lands even when this tab isn't focused.
                Offered here because this is the moment it is easiest to say yes to. */}
            {job && !isExpired && durationTotalSeconds > 0 && <SessionAlertsToggle />}

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
                  // Both actions branch on the template match; until it settles they'd re-enter the
                  // wrong flow, so show them working rather than inexplicably dead.
                  loading={!!job && !templateKnown && !templateMatchFailed}
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
                  loading={!!job && !templateKnown && !templateMatchFailed}
                  onClick={() => {
                    posthog.capture('inference_prolong_opened', { serviceId: id, canProlong, branch });
                    setProlongOpen(true);
                  }}
                  size="md"
                  variant="filled"
                >
                  Prolong session
                </Button>
              </div>
            </div>
            {/* Edit and Prolong both branch on which template this service runs, and the catalogue
                that answers that is unreachable — so say why they're unavailable rather than sending
                the user into the wrong flow on a guess. Restart is unaffected: it needs no identity. */}
            {templateMatchFailed && (
              <div className="textErrorDarker">
                Couldn&apos;t reach the node&apos;s template catalogue, so this service&apos;s app is unknown — Edit and
                Prolong are unavailable. Reload to try again.
              </div>
            )}
          </Card>

          {/* A bundle's weights land minutes after the container reports Running, so say so here
              rather than letting the user open an app with empty model pickers. Advisory only —
              derived from the container log, gated on the container actually being up, and gone the
              moment the script reports completion. */}
          {isBundleService && template && isRunning && (
            <ProvisioningProgress
              active={isRunning}
              consumerAddress={account.address ?? undefined}
              nodePeerId={nodePeerId}
              nodeUri={nodeUri}
              serviceId={id}
              template={template}
            />
          )}

          {/* Model. Rendered even when there's no model to name: the card is the only place the model
              appears, so "unknown" must be stated rather than the card silently vanishing — otherwise
              the previous service's card is the last thing the user saw here. Skipped entirely for a
              template app, which serves no model at all (its whole config rides in the template). */}
          {!isTemplate && (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <div className={styles.howToHead}>
                <h3>Model</h3>
                {models.length > 0 && <span className="textSecondary">Expand for launch parameters</span>}
              </div>
              {models.length > 0 ? (
                <InferenceModelList models={models} />
              ) : (
                <div className="textSecondary">
                  {jobLoading || matchingTemplate
                    ? 'Loading model…'
                    : 'Unknown model — neither the node nor this service’s record names one.'}
                </div>
              )}
            </Card>
          )}

          {/* Template (app service) — the counterpart of the Model card above. `envValues` is
              deliberately not passed: the values a service was started with live in the container's
              userData and come back on neither the job record nor the URL, so claiming a set here
              would be guesswork (TemplateSummary says as much instead). */}
          {isTemplate && template && (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              <div className={styles.howToHead}>
                <h3>{isBundleService ? 'Template' : 'Service'}</h3>
                <span className="textSecondary">
                  {isBundleService ? 'Expand for models and container details' : 'Expand for container details'}
                </span>
              </div>
              <TemplateSummary runningImageRef={runningImageRef ?? undefined} template={template} />
            </Card>
          )}

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

          {/* Resource usage — booked allocation lives in the Environment card above; this is what the
              container is ACTUALLY doing against it. Metrics ride free on the existing status poll
              already fetching status, so there's no card at all when a node doesn't report them — except
              while the service runs, where a silent gap would read as a broken card rather than a node
              that simply doesn't sample. */}
          {(metrics || isRunning) && (
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              {metrics ? (
                <ResourceUsagePanel
                  bookedResources={bookedForUsagePanel}
                  hardwareNames={hardwareNames}
                  history={metricsHistory}
                  metrics={metrics}
                  title={<h3>Resource usage</h3>}
                  variant="page"
                />
              ) : (
                <>
                  <h3>Resource usage</h3>
                  <div className="textSecondary">This node doesn&apos;t report runtime metrics.</div>
                </>
              )}
            </Card>
          )}

          {/* How to use — hidden once expired: the endpoint is torn down even if the status still
              reads Running (expiry-cron lag), so a callable URL there would be misleading. */}
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <div className={styles.howToHead}>
              <h3>How to use</h3>
              {!isTemplate && baseUrl && !isExpired ? (
                <div className={styles.docsActions}>
                  <Button
                    color="accent1"
                    contentAfter={<OpenInNewIcon fontSize="inherit" />}
                    href={OPENAI_API_SPEC_URL}
                    size="sm"
                    target="_blank"
                    variant="transparent"
                  >
                    OpenAI API reference
                  </Button>
                  {docsUrl && (
                    <Button
                      color="accent1"
                      contentAfter={<OpenInNewIcon fontSize="inherit" />}
                      href={docsUrl}
                      size="sm"
                      target="_blank"
                      variant="filled"
                    >
                      Service API docs
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

            {isTemplate ? (
              templateUiUrl && !isExpired ? (
                <div className={styles.endpoints}>
                  <Card className={styles.endpoint} innerShadow="black" padding="xs" radius="lg" variant="glass">
                    <div className={`chip chipGlass ${styles.endpointChip}`}>App URL</div>
                    <span className={styles.endpointPath}>{templateUiUrl}</span>
                    <span className={styles.endpointDescription}>Open this app&apos;s web UI in a new tab</span>
                    <a
                      className={styles.endpointAction}
                      href={templateUiUrl}
                      onClick={() =>
                        posthog.capture('inference_service_consumed', {
                          serviceId: id,
                          kind: 'open_ui',
                          templateId: template?.id,
                          branch,
                        })
                      }
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Button
                        color="accent1"
                        contentAfter={<OpenInNewIcon fontSize="inherit" />}
                        size="sm"
                        variant="filled"
                      >
                        Open UI
                      </Button>
                    </a>
                  </Card>
                </div>
              ) : (
                <div className="textSecondary">
                  {isExpired
                    ? 'This session has ended — the app is no longer available.'
                    : isRunning
                      ? 'App is running but exposed no endpoint.'
                      : 'The app URL becomes available once the service is running…'}
                </div>
              )
            ) : baseUrl && !isExpired ? (
              <>
                <div className={styles.endpoints}>
                  <Card className={styles.endpoint} innerShadow="black" padding="xs" radius="lg" variant="glass">
                    <div className={`chip chipGlass ${styles.endpointChip}`}>Base URL</div>
                    <span className={styles.endpointPath}>{baseUrl}</span>
                    <span className={styles.endpointDescription}>
                      OpenAI-compatible — append a route from the references above
                    </span>
                    {/* CopyButton takes no click callback, so wrap it — analytics only, copy
                        behaviour is unchanged. */}
                    <span
                      onClick={() =>
                        posthog.capture('inference_service_consumed', {
                          serviceId: id,
                          kind: 'copy_base_url',
                          templateId: undefined,
                          branch,
                        })
                      }
                    >
                      <CopyButton
                        className={styles.endpointAction}
                        color="accent2"
                        contentToCopy={baseUrl}
                        variant="filled"
                      />
                    </span>
                  </Card>
                </div>
                <div className={styles.quickTestHead}>
                  <h4>Quick test</h4>
                  <span
                    onClick={() =>
                      posthog.capture('inference_service_consumed', {
                        serviceId: id,
                        kind: 'copy_curl',
                        templateId: undefined,
                        branch,
                      })
                    }
                  >
                    <CopyButton color="accent2" contentToCopy={curlSnippet} variant="filled" />
                  </span>
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
                <Button
                  color="accent1"
                  onClick={() => {
                    posthog.capture('inference_logs_opened', { serviceId: id, status: job?.status, branch });
                    setLogsOpen(true);
                  }}
                  size="md"
                  variant="outlined"
                >
                  Show logs
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      <ProlongSessionModal
        isOpen={prolongOpen}
        maxSeconds={prolongMaxSeconds}
        minSeconds={environment?.minJobDuration}
        onClose={() => setProlongOpen(false)}
        onConfirm={onProlong}
      />
    </Container>
  );
};

export default ManageServicePage;
