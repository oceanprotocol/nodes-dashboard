import { GpuSelection, ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { getApiRoute } from '@/config';
import { SelectedToken } from '@/context/run-job-context';
import { useP2P } from '@/contexts/P2PContext';
import { captureError } from '@/lib/analytics';
import { getTokenSymbol } from '@/lib/token-symbol';
import {
  decodeModelIds,
  DEFAULT_INFERENCE_ENGINE,
  encodeModelIds,
  fetchHuggingFaceModel,
} from '@/services/huggingface-service';
import {
  decodeGpuSelection,
  decodeModelParams,
  decodeResourceSizing,
  encodeGpuSelection,
  encodeModelParams,
  encodeResourceSizing,
  firstQueryValue,
} from '@/services/inference-url';
import { fetchTemplates, findTemplateById } from '@/services/service-templates';
import { ComputeEnvironment, EnvNodeInfo, NodeEnvironments } from '@/types/environments';
import { HuggingFaceModel, InferenceEngine, ModelParameters } from '@/types/huggingface';
import { AppTemplate } from '@/types/templates';
import axios from 'axios';
import { useRouter } from 'next/router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/** Selection encoded as individual query params, carried forward with `...router.query` (see inference-url.ts). */
export type InferenceSelectionQuery = Partial<{
  models: string;
  peerId: string;
  env: string;
  gpus: string;
  /** Inference engine driving the launch (`vllm` | `llamacpp`) — picks the image, port & command. */
  engine: string;
  /** Shared-resource sizing (`mode:cpu:ram:disk`) — `pinned` quick start / `floor` handoff; absent for a plain slice. */
  res: string;
  token: string;
  duration: string;
  params: string;
  /** Selected app-template id (Templates flow) — the `[templateId]` route param, restored on reload. */
  template: string;
  /** Persistent-storage bucket the service mounts at /data/outputs (model cache + outputs). */
  bucket: string;
  /** '1' when re-entering the flow to edit a running service — skips env selection & payment. */
  edit: string;
  /** Running service being edited/prolonged — target of serviceExtend / stop-on-relaunch. */
  serviceId: string;
}>;

export type SelectedInferenceEnv = {
  environment: ComputeEnvironment;
  nodeInfo: EnvNodeInfo;
  /** Units to use per GPU type, keyed by type (defaults to all units of every type). */
  gpuSelection: GpuSelection;
  /**
   * How the shared CPU/RAM/disk are sized: `pinned` fixed amounts (quick start) or a `floor` under the
   * GPU-fraction slice (advanced handoff). Omit for a pure proportional slice (custom flow). See
   * {@link ResourceSizing}.
   */
  sizing?: ResourceSizing;
};

type InferenceContextType = {
  selectedModels: HuggingFaceModel[];
  setSelectedModels: (models: HuggingFaceModel[]) => void;
  toggleModel: (model: HuggingFaceModel) => void;
  /** Replace the whole selection with a single model (or clear it), pruning deselected models' params. */
  selectSingleModel: (model: HuggingFaceModel) => void;
  isModelSelected: (modelId: string) => boolean;
  selectedEnv: SelectedInferenceEnv | null;
  setSelectedEnv: (env: SelectedInferenceEnv | null) => void;
  selectedToken: SelectedToken | null;
  setSelectedToken: (token: SelectedToken | null) => void;
  /** Hugging Face access token, shared across all selected models (for gated/private repos). */
  hfToken: string;
  setHfToken: (token: string) => void;
  jobDurationSeconds: number;
  setJobDurationSeconds: (seconds: number) => void;
  /**
   * Inference engine for the custom flow (vLLM | llama.cpp). Drives which launch params the config
   * step edits and the image/port/command at launch. The committed ModelParameters carry the same
   * engine (params.engine is authoritative at launch/manage); this is the in-flow selection driver.
   */
  engine: InferenceEngine;
  setEngine: (engine: InferenceEngine) => void;
  modelParamsByModel: Record<string, ModelParameters>;
  setParamsForModel: (modelId: string, params: ModelParameters) => void;
  /** Selected app template (Templates flow) — an APP to launch, distinct from the HF-model flows. */
  selectedTemplate: AppTemplate | null;
  setSelectedTemplate: (template: AppTemplate | null) => void;
  /** Persistent-storage bucket the service mounts at /data/outputs (model cache + outputs). */
  selectedBucketId: string | null;
  setSelectedBucketId: (id: string | null) => void;
  /**
   * User-supplied values for the selected template's `userConfigurableEnvVars` (e.g. HF_TOKEN),
   * committed on the template config step. Kept in memory only — these are secrets, never put in the
   * URL. Sent as container userData at launch/relaunch (operator launch flags ride in the template's
   * command, not env).
   */
  templateEnvValues: Record<string, string>;
  setTemplateEnvValues: (values: Record<string, string>) => void;
  clearSelection: () => void;
  /** True once URL hydration has run (or was skipped) — pages wait on this before reading selection. */
  hydrateFromUrlFinished: boolean;
  /** True when a selection encoded in the URL couldn't be fully restored (network/model gone). */
  hydrationFailed: boolean;
  /** Re-run URL hydration after a failure (e.g. a "Retry" button); no-op if none is in the URL. */
  retryHydration: () => void;
  /**
   * Build the selection query params (models/peerId/env/gpus/token/duration/params) to carry between
   * steps. Spread into `router.query`: `router.push({ pathname, query: { ...router.query, ...build() } })`.
   * Pass overrides for values chosen in the same tick that aren't in context state yet.
   */
  buildSelectionQuery: (overrides?: SelectionOverrides) => InferenceSelectionQuery;
};

/** Same-tick selection values not yet reflected in context state (e.g. an env just clicked). */
type SelectionOverrides = {
  models?: HuggingFaceModel[];
  peerId?: string;
  envId?: string;
  gpuSelection?: GpuSelection;
  sizing?: ResourceSizing;
  tokenAddress?: string;
  durationSeconds?: number;
  engine?: InferenceEngine;
  modelParamsByModel?: Record<string, ModelParameters>;
  templateId?: string;
  bucketId?: string;
};

export const DEFAULT_JOB_DURATION_SECONDS = 3600;

// The HF token is kept out of the URL (it's a secret) but persisted per-tab so a refresh mid-flow
// doesn't force the user to re-enter it for gated models. sessionStorage clears when the tab closes.
const HF_TOKEN_STORAGE_KEY = 'inference:hfToken';

function readStoredHfToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.sessionStorage.getItem(HF_TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

const InferenceContext = createContext<InferenceContextType | undefined>(undefined);

export const InferenceProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  // Templates are served by the node; restoreTemplate fetches them, so it waits on the P2P node.
  const { getServiceTemplates, isReady: p2pReady } = useP2P();
  const [selectedModels, setSelectedModels] = useState<HuggingFaceModel[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<SelectedInferenceEnv | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [hfToken, setHfTokenState] = useState<string>('');
  const [jobDurationSeconds, setJobDurationSeconds] = useState<number>(DEFAULT_JOB_DURATION_SECONDS);
  const [engine, setEngine] = useState<InferenceEngine>(DEFAULT_INFERENCE_ENGINE);
  const [modelParamsByModel, setModelParamsByModel] = useState<Record<string, ModelParameters>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplate | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [templateEnvValues, setTemplateEnvValues] = useState<Record<string, string>>({});
  const [hydrateFromUrlFinished, setHydrateFromUrlFinished] = useState(false);
  // True when the URL described a selection we couldn't fully rebuild (HF/env fetch failed or a
  // model/env is gone). Lets guards distinguish that from "no selection in URL" and offer a retry.
  const [hydrationFailed, setHydrationFailed] = useState(false);
  // The URL signature (models/peerId/env/serviceId) we last hydrated from. Re-hydration keys on this
  // changing — so a client-side nav that lands on a *different* selection (e.g. Manage from the
  // services table, where the Provider is already mounted and never remounts) re-runs hydration
  // instead of leaving stale/empty context. Same signature = no re-run, so StrictMode's double mount
  // and within-flow param tweaks (gpus/token/params, derived from context) don't refetch.
  const hydratedSignatureRef = useRef<string | null>(null);
  // URL signature (see hydratedSignatureRef) for which `inference_hydration_failed` was already
  // captured — prevents a retry against the same signature, or an unrelated re-render, from
  // re-firing the same failure event.
  const hydrationFailedTrackedRef = useRef<string | null>(null);

  // Persist the HF token to sessionStorage on change so a refresh mid-flow doesn't force the user to
  // re-enter it for gated models. The token stays out of the URL (it's a secret).
  const setHfToken = useCallback((token: string) => {
    setHfTokenState(token);
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          window.sessionStorage.setItem(HF_TOKEN_STORAGE_KEY, token);
        } else {
          window.sessionStorage.removeItem(HF_TOKEN_STORAGE_KEY);
        }
      } catch {
        // Storage unavailable (private mode / quota) — token just won't survive refresh.
      }
    }
  }, []);

  // Restore the stored token once on mount (in an effect so SSR/first client render both start '').
  useEffect(() => {
    const stored = readStoredHfToken();
    if (stored) {
      setHfTokenState(stored);
    }
  }, []);

  const toggleModel = useCallback(
    (model: HuggingFaceModel) => {
      const isSelected = selectedModels.some((m) => m.id === model.id);
      // Compute the next selection from the closure, then drive both setters sequentially — never
      // nest one setter inside the other's updater (updaters must stay pure; React may re-run them).
      setSelectedModels(isSelected ? selectedModels.filter((m) => m.id !== model.id) : [...selectedModels, model]);
      if (isSelected) {
        // Deselecting: also drop any committed params so they can't linger in state or the URL.
        setModelParamsByModel(({ [model.id]: _removed, ...rest }) => rest);
      }
    },
    [selectedModels]
  );

  /**
   * Single-model flow: make the selection exactly `[model]` (or clear it), pruning the committed
   * params of every model that's no longer selected. Clicking the already-selected model clears it.
   * Prevents stale launch settings from resurfacing when switching A → B → A: A's params are dropped
   * the moment A is deselected, not left lingering in `modelParamsByModel`.
   */
  const selectSingleModel = useCallback(
    (model: HuggingFaceModel) => {
      // Compute the next selection from the closure, then drive both setters sequentially — never
      // nest one setter inside the other's updater (updaters must stay pure; React may re-run them).
      const next = selectedModels.some((m) => m.id === model.id) ? [] : [model];
      const keep = new Set(next.map((m) => m.id));
      setSelectedModels(next);
      setModelParamsByModel((params) => Object.fromEntries(Object.entries(params).filter(([id]) => keep.has(id))));
    },
    [selectedModels]
  );

  const isModelSelected = useCallback(
    (modelId: string) => selectedModels.some((m) => m.id === modelId),
    [selectedModels]
  );

  const setParamsForModel = useCallback((modelId: string, params: ModelParameters) => {
    setModelParamsByModel((current) => ({ ...current, [modelId]: params }));
  }, []);

  const buildSelectionQuery = useCallback(
    (overrides?: SelectionOverrides): InferenceSelectionQuery => {
      const peerId = overrides?.peerId ?? selectedEnv?.nodeInfo.id;
      const envId = overrides?.envId ?? selectedEnv?.environment.id;
      const gpuSelection = overrides?.gpuSelection ?? selectedEnv?.gpuSelection;
      const sizing = overrides?.sizing ?? selectedEnv?.sizing;
      const tokenAddress = overrides?.tokenAddress ?? selectedToken?.address;
      const allParams = overrides?.modelParamsByModel ?? modelParamsByModel;
      const models = overrides?.models ?? selectedModels;
      const duration = overrides?.durationSeconds ?? jobDurationSeconds;
      const selectedEngine = overrides?.engine ?? engine;
      const templateId = overrides?.templateId ?? selectedTemplate?.id;
      const bucketId = overrides?.bucketId ?? selectedBucketId;

      const query: InferenceSelectionQuery = {};
      const modelIds = models.map((m) => m.id);
      if (modelIds.length > 0) {
        query.models = encodeModelIds(modelIds);
      }
      // Only carry params for models still selected — a model deselected after being configured must
      // not leak its params into the URL / launch payload.
      const params = Object.fromEntries(modelIds.filter((id) => allParams[id]).map((id) => [id, allParams[id]]));
      if (peerId) {
        query.peerId = peerId;
      }
      if (envId) {
        query.env = envId;
      }
      const gpus = encodeGpuSelection(gpuSelection);
      if (gpus) {
        query.gpus = gpus;
      }
      const res = encodeResourceSizing(sizing);
      if (res) {
        query.res = res;
      }
      if (tokenAddress) {
        query.token = tokenAddress;
      }
      query.engine = selectedEngine;
      query.duration = String(duration);
      if (templateId) {
        query.template = templateId;
      }
      if (bucketId) {
        query.bucket = bucketId;
      }
      const encodedParams = encodeModelParams(params);
      if (encodedParams) {
        query.params = encodedParams;
      }
      // Carry the edit flag forward so every step keeps its edit-mode behavior across navigations.
      const editFlag = firstQueryValue(router.query.edit);
      if (editFlag) {
        query.edit = editFlag;
      }
      // Carry the target service id forward too — edit/prolong need it at the payment step to
      // stop/extend the running service.
      const serviceId = firstQueryValue(router.query.serviceId);
      if (serviceId) {
        query.serviceId = serviceId;
      }
      return query;
    },
    [
      selectedModels,
      selectedEnv,
      selectedToken,
      jobDurationSeconds,
      engine,
      modelParamsByModel,
      selectedTemplate,
      selectedBucketId,
      router.query.edit,
      router.query.serviceId,
    ]
  );

  /**
   * Rebuild the selection from the URL query params on a hard reload / deep link. Models come from
   * Hugging Face by id; the environment + node are re-resolved from the environments API by
   * peerId/env (mirrors the run-job flow). Best-effort — missing pieces just stay unselected, and
   * models vs. environment restore independently so one failure doesn't drop the other.
   */
  const hydrateFromQueryParams = useCallback(async () => {
    const q = router.query;
    // Synchronous restores first — these never fail and don't depend on the network.
    const duration = Number(firstQueryValue(q.duration));
    if (Number.isFinite(duration) && duration > 0) {
      setJobDurationSeconds(duration);
    }
    // Reset to exactly what the URL carries (even when it carries nothing). The Provider is mounted
    // once and never remounts, so re-hydrating on a client-side nav must overwrite the prior
    // selection's params — not merge onto them. Otherwise switching to another service of the SAME
    // model id (whose Manage link carries no `params`) would leave the previous run's params live
    // under the colliding model-id key, and the manage page's dockerCmd seed (which refuses to
    // overwrite an already-set key) could never correct it.
    const restoredParams = decodeModelParams(q.params);
    setModelParamsByModel(restoredParams);
    // Restore the engine: the explicit `engine` param wins; else infer it from the committed params
    // (their `engine` discriminator); else fall back to the default. Keeps the config step's selector
    // and the launch command in sync on a refresh / deep link.
    const engineParam = firstQueryValue(q.engine);
    const paramEngine = Object.values(restoredParams)[0]?.engine;
    const restoredEngine: InferenceEngine =
      engineParam === 'vllm' || engineParam === 'llamacpp' ? engineParam : (paramEngine ?? DEFAULT_INFERENCE_ENGINE);
    setEngine(restoredEngine);
    // Plain id, not a secret (unlike templateEnvValues), and no async fetch needed (unlike
    // restoreTemplate) — restored synchronously so a template-restore failure can't discard it.
    setSelectedBucketId(firstQueryValue(q.bucket) ?? null);

    // Each restore reports whether it fully succeeded, so we can tell "URL carried a selection we
    // failed to rebuild" (a real error — don't bounce the user) from "URL had nothing to restore".
    const restoreModels = async (): Promise<boolean> => {
      const modelIds = decodeModelIds(q.models);
      if (modelIds.length === 0) {
        // Same reset rule as the params above: the Provider never remounts, so a nav whose URL carries
        // no models must CLEAR the selection, not keep the previous one. Otherwise opening a service
        // whose record has no recoverable model id (e.g. a malformed session) would show the
        // previously-managed service's model as if it were its own.
        setSelectedModels([]);
        return true;
      }
      const results = await Promise.allSettled(modelIds.map((id) => fetchHuggingFaceModel(id)));
      const models = results
        .filter((r): r is PromiseFulfilledResult<HuggingFaceModel> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (models.length > 0) {
        setSelectedModels(models);
      }
      // All requested models must come back; a partial restore would silently drop the rest.
      return models.length === modelIds.length;
    };

    const restoreEnv = async (): Promise<boolean> => {
      const peerId = firstQueryValue(q.peerId);
      const envId = firstQueryValue(q.env);
      if (!peerId || !envId) {
        return true;
      }
      const response = await axios.get<{ envs: NodeEnvironments[] }>(getApiRoute('environments'), {
        params: {
          filters: JSON.stringify({ id: { operator: 'eq', value: peerId } }),
          size: 1000,
        },
      });
      const foundNode = response.data.envs.find((node) => node.id === peerId);
      // The env id's suffix (after `-`) rotates per epoch, so a stored id goes stale. Match the exact
      // id when still present, else fall back to the stable prefix (the environment's real identity).
      const envPrefix = envId.split('-')[0];
      const envs = foundNode?.computeEnvironments.environments ?? [];
      const foundEnv = envs.find((env) => env.id === envId) ?? envs.find((env) => env.id.split('-')[0] === envPrefix);
      if (!foundNode || !foundEnv) {
        return false;
      }
      setSelectedEnv({
        environment: foundEnv,
        gpuSelection: decodeGpuSelection(q.gpus) ?? {},
        sizing: decodeResourceSizing(q.res),
        nodeInfo: {
          currentAddrs: foundNode.currentAddrs,
          friendlyName: foundNode.friendlyName,
          id: foundNode.id,
          latestBenchmarkResults: foundNode.latestBenchmarkResults,
          multiaddrs: foundNode.multiaddrs,
        },
      });
      // Token restore is best-effort and must not abort env restore if the symbol lookup throws.
      const tokenAddress = firstQueryValue(q.token);
      if (tokenAddress) {
        let symbol: string | null = null;
        try {
          symbol = await getTokenSymbol(tokenAddress);
        } catch (error) {
          console.error('Failed to resolve token symbol during hydration:', error);
        }
        setSelectedToken({ address: tokenAddress, symbol: symbol ?? '' });
      }
      return true;
    };

    // Restore the selected app template (Templates flow) from its id. Best-effort, like models/env.
    const restoreTemplate = async (): Promise<boolean> => {
      const templateId = firstQueryValue(q.template);
      if (!templateId) {
        setSelectedTemplate(null);
        return true;
      }
      const templates = await fetchTemplates(getServiceTemplates);
      const template = findTemplateById(templates, templateId);
      if (!template) {
        return false;
      }
      setSelectedTemplate(template);
      return true;
    };

    const restoreNames = ['models', 'env', 'template'] as const;
    const outcomes = await Promise.allSettled([restoreModels(), restoreEnv(), restoreTemplate()]);
    // A rejected restore (network throw) or a resolved-but-incomplete restore (missing model/env)
    // both mean the URL described a selection we couldn't rebuild — flag it so the step guards show
    // a retry instead of silently bouncing the user back and discarding the URL selection.
    const failed = outcomes.some((o) => o.status === 'rejected' || o.value === false);
    outcomes.forEach((o) => {
      if (o.status === 'rejected') {
        console.error('Failed to hydrate part of the inference selection from URL:', o.reason);
      }
    });
    if (failed) {
      // Guard against spamming: only capture once per distinct URL signature (retries against the
      // same signature, or unrelated re-renders, must not re-fire this).
      const signature = hydratedSignatureRef.current;
      if (hydrationFailedTrackedRef.current !== signature) {
        hydrationFailedTrackedRef.current = signature;
        const failedRestores = restoreNames.filter(
          (_name, index) => outcomes[index].status === 'rejected' || outcomes[index].value === false
        );
        captureError('inference_hydration_failed', new Error('hydrate_from_query_params_failed'), {
          stage: 'hydrate_from_query',
          failed_restores: failedRestores,
          // No `branch` here: hydration failing is exactly the case where the selection (and so the
          // template that distinguishes template-from-service) couldn't be restored. The query keys
          // present are the closest honest signal of which flow the dead link belonged to.
          query_keys: Object.keys(router.query),
        });
      }
    }
    setHydrationFailed(failed);
    setHydrateFromUrlFinished(true);
  }, [router.query, getServiceTemplates]);

  // Hydrate after the router is ready so query params are populated. Re-runs when the identifying
  // signature changes (a nav to a different selection) so client-side nav — where the Provider stays
  // mounted — re-hydrates instead of showing stale/empty context. The signature guard also absorbs
  // StrictMode's double mount and ignores within-flow param tweaks (same identity).
  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    // A template restore fetches from the node — wait for the P2P node before hydrating, else the
    // fetch throws and the restore is (wrongly) flagged as failed. Non-template selections (models/
    // env, restored via HF/axios) don't wait. Returning before consuming the signature lets the
    // effect re-run and hydrate once p2pReady flips true.
    if (firstQueryValue(router.query.template) && !p2pReady) {
      return;
    }
    const sigPart = (v: string | string[] | undefined) => firstQueryValue(v) ?? '';
    const signature = [
      sigPart(router.query.models),
      sigPart(router.query.peerId),
      sigPart(router.query.env),
      sigPart(router.query.serviceId),
      sigPart(router.query.template),
    ].join('|');
    if (hydratedSignatureRef.current === signature) {
      return;
    }
    hydratedSignatureRef.current = signature;
    if (router.query.models || router.query.peerId || router.query.template) {
      // Re-hydration (signature changed on a client-side nav): flip back to "not finished" so step
      // guards show loading against the new selection instead of the previous one's stale state.
      setHydrateFromUrlFinished(false);
      setHydrationFailed(false);
      hydrateFromQueryParams();
    } else {
      setHydrateFromUrlFinished(true);
    }
  }, [
    hydrateFromQueryParams,
    router.isReady,
    p2pReady,
    router.query.models,
    router.query.peerId,
    router.query.env,
    router.query.serviceId,
    router.query.template,
  ]);

  // Retry a failed hydration: reset the finished/failed flags and re-run against the current URL.
  const retryHydration = useCallback(() => {
    if (!router.query.models && !router.query.peerId && !router.query.template) {
      return;
    }
    setHydrationFailed(false);
    setHydrateFromUrlFinished(false);
    // Re-run against the current URL directly. Leave hydratedSignatureRef at the current signature
    // (the effect already set it) so the guard stays synced — clearing it would make a later
    // non-signature URL change (env/serviceId) re-trigger an unnecessary re-hydration.
    hydrateFromQueryParams();
  }, [hydrateFromQueryParams, router.query.models, router.query.peerId, router.query.template]);

  const value = useMemo<InferenceContextType>(
    () => ({
      selectedModels,
      setSelectedModels,
      toggleModel,
      selectSingleModel,
      isModelSelected,
      selectedEnv,
      setSelectedEnv,
      selectedToken,
      setSelectedToken,
      hfToken,
      setHfToken,
      jobDurationSeconds,
      setJobDurationSeconds,
      engine,
      setEngine,
      modelParamsByModel,
      setParamsForModel,
      selectedTemplate,
      setSelectedTemplate,
      selectedBucketId,
      setSelectedBucketId,
      templateEnvValues,
      setTemplateEnvValues,
      clearSelection: () => {
        setSelectedModels([]);
        setSelectedEnv(null);
        setSelectedToken(null);
        setHfToken('');
        setJobDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
        setEngine(DEFAULT_INFERENCE_ENGINE);
        setModelParamsByModel({});
        setSelectedTemplate(null);
        setSelectedBucketId(null);
        setTemplateEnvValues({});
      },
      hydrateFromUrlFinished,
      hydrationFailed,
      retryHydration,
      buildSelectionQuery,
    }),
    [
      selectedModels,
      toggleModel,
      selectSingleModel,
      isModelSelected,
      selectedEnv,
      selectedToken,
      hfToken,
      setHfToken,
      jobDurationSeconds,
      engine,
      modelParamsByModel,
      setParamsForModel,
      selectedTemplate,
      selectedBucketId,
      templateEnvValues,
      hydrateFromUrlFinished,
      hydrationFailed,
      retryHydration,
      buildSelectionQuery,
    ]
  );

  return <InferenceContext.Provider value={value}>{children}</InferenceContext.Provider>;
};

export const useInferenceContext = () => {
  const context = useContext(InferenceContext);
  if (!context) {
    throw new Error('useInferenceContext must be used within a InferenceProvider');
  }
  return context;
};
