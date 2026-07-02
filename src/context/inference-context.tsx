import { getApiRoute } from '@/config';
import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { decodeModelIds, encodeModelIds, fetchHuggingFaceModel } from '@/services/huggingface-service';
import {
  decodeGpuSelection,
  decodeModelParams,
  encodeGpuSelection,
  encodeModelParams,
} from '@/services/inference-url';
import { ComputeEnvironment, EnvNodeInfo, NodeEnvironments } from '@/types/environments';
import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
import axios from 'axios';
import { useRouter } from 'next/router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/** Selection encoded as individual query params, carried forward with `...router.query` (see inference-url.ts). */
export type InferenceSelectionQuery = Partial<{
  models: string;
  peerId: string;
  env: string;
  gpus: string;
  token: string;
  duration: string;
  params: string;
}>;

export type SelectedInferenceEnv = {
  environment: ComputeEnvironment;
  nodeInfo: EnvNodeInfo;
  /** Units to use per GPU type, keyed by type (defaults to all units of every type). */
  gpuSelection: GpuSelection;
};

type InferenceContextType = {
  selectedModels: HuggingFaceModel[];
  setSelectedModels: (models: HuggingFaceModel[]) => void;
  toggleModel: (model: HuggingFaceModel) => void;
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
  modelParamsByModel: Record<string, ModelParameters>;
  setParamsForModel: (modelId: string, params: ModelParameters) => void;
  clearSelection: () => void;
  /** True once URL hydration has run (or was skipped) — pages wait on this before reading selection. */
  hydrateFromUrlFinished: boolean;
  /**
   * Build the selection query params (models/peerId/env/gpus/token/duration/params) to carry between
   * steps. Spread into `router.query`: `router.push({ pathname, query: { ...router.query, ...build() } })`.
   * Pass overrides for values chosen in the same tick that aren't in context state yet.
   */
  buildSelectionQuery: (overrides?: SelectionOverrides) => InferenceSelectionQuery;
};

/** Same-tick selection values not yet reflected in context state (e.g. an env just clicked). */
type SelectionOverrides = {
  peerId?: string;
  envId?: string;
  gpuSelection?: GpuSelection;
  tokenAddress?: string;
  modelParamsByModel?: Record<string, ModelParameters>;
};

const DEFAULT_JOB_DURATION_SECONDS = 3600;

const InferenceContext = createContext<InferenceContextType | undefined>(undefined);

export const InferenceProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [selectedModels, setSelectedModels] = useState<HuggingFaceModel[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<SelectedInferenceEnv | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [hfToken, setHfToken] = useState<string>('');
  const [jobDurationSeconds, setJobDurationSeconds] = useState<number>(DEFAULT_JOB_DURATION_SECONDS);
  const [modelParamsByModel, setModelParamsByModel] = useState<Record<string, ModelParameters>>({});
  const [hydrateFromUrlFinished, setHydrateFromUrlFinished] = useState(false);
  // Ref (not state) so StrictMode's double-invoked mount effect can't fire hydration twice.
  const hydrationStartedRef = useRef(false);

  const toggleModel = useCallback((model: HuggingFaceModel) => {
    setSelectedModels((current) => {
      if (current.some((m) => m.id === model.id)) {
        return current.filter((m) => m.id !== model.id);
      }
      return [...current, model];
    });
  }, []);

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
      const tokenAddress = overrides?.tokenAddress ?? selectedToken?.address;
      const params = overrides?.modelParamsByModel ?? modelParamsByModel;

      const query: InferenceSelectionQuery = {};
      const modelIds = selectedModels.map((m) => m.id);
      if (modelIds.length > 0) {
        query.models = encodeModelIds(modelIds);
      }
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
      if (tokenAddress) {
        query.token = tokenAddress;
      }
      query.duration = String(jobDurationSeconds);
      const encodedParams = encodeModelParams(params);
      if (encodedParams) {
        query.params = encodedParams;
      }
      return query;
    },
    [selectedModels, selectedEnv, selectedToken, jobDurationSeconds, modelParamsByModel]
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
    const duration = Number(Array.isArray(q.duration) ? q.duration[0] : q.duration);
    if (Number.isFinite(duration) && duration > 0) {
      setJobDurationSeconds(duration);
    }
    const params = decodeModelParams(q.params);
    if (Object.keys(params).length > 0) {
      setModelParamsByModel(params);
    }

    const restoreModels = async () => {
      const modelIds = decodeModelIds(q.models);
      if (modelIds.length === 0) {
        return;
      }
      const results = await Promise.allSettled(modelIds.map((id) => fetchHuggingFaceModel(id)));
      const models = results
        .filter((r): r is PromiseFulfilledResult<HuggingFaceModel> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (models.length > 0) {
        setSelectedModels(models);
      }
    };

    const restoreEnv = async () => {
      const peerId = Array.isArray(q.peerId) ? q.peerId[0] : q.peerId;
      const envId = Array.isArray(q.env) ? q.env[0] : q.env;
      if (!peerId || !envId) {
        return;
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
        return;
      }
      setSelectedEnv({
        environment: foundEnv,
        gpuSelection: decodeGpuSelection(q.gpus) ?? {},
        nodeInfo: {
          currentAddrs: foundNode.currentAddrs,
          friendlyName: foundNode.friendlyName,
          id: foundNode.id,
          latestBenchmarkResults: foundNode.latestBenchmarkResults,
          multiaddrs: foundNode.multiaddrs,
        },
      });
      // Token restore is best-effort and must not abort env restore if the symbol lookup throws.
      const tokenAddress = Array.isArray(q.token) ? q.token[0] : q.token;
      if (tokenAddress) {
        let symbol: string | null = null;
        try {
          symbol = await getTokenSymbol(tokenAddress);
        } catch (error) {
          console.error('Failed to resolve token symbol during hydration:', error);
        }
        setSelectedToken({ address: tokenAddress, symbol: symbol ?? '' });
      }
    };

    const outcomes = await Promise.allSettled([restoreModels(), restoreEnv()]);
    outcomes.forEach((o) => {
      if (o.status === 'rejected') {
        console.error('Failed to hydrate part of the inference selection from URL:', o.reason);
      }
    });
    setHydrateFromUrlFinished(true);
  }, [router.query]);

  // Hydrate once, after the router is ready so query params are populated. Ref guard survives
  // StrictMode's double mount; skip the network work when there's no selection in the URL.
  useEffect(() => {
    if (hydrationStartedRef.current || !router.isReady) {
      return;
    }
    hydrationStartedRef.current = true;
    if (router.query.models || router.query.peerId) {
      hydrateFromQueryParams();
    } else {
      setHydrateFromUrlFinished(true);
    }
  }, [hydrateFromQueryParams, router.isReady, router.query.models, router.query.peerId]);

  const value = useMemo<InferenceContextType>(
    () => ({
      selectedModels,
      setSelectedModels,
      toggleModel,
      isModelSelected,
      selectedEnv,
      setSelectedEnv,
      selectedToken,
      setSelectedToken,
      hfToken,
      setHfToken,
      jobDurationSeconds,
      setJobDurationSeconds,
      modelParamsByModel,
      setParamsForModel,
      clearSelection: () => {
        setSelectedModels([]);
        setSelectedEnv(null);
        setSelectedToken(null);
        setHfToken('');
        setJobDurationSeconds(DEFAULT_JOB_DURATION_SECONDS);
        setModelParamsByModel({});
      },
      hydrateFromUrlFinished,
      buildSelectionQuery,
    }),
    [
      selectedModels,
      toggleModel,
      isModelSelected,
      selectedEnv,
      selectedToken,
      hfToken,
      jobDurationSeconds,
      modelParamsByModel,
      setParamsForModel,
      hydrateFromUrlFinished,
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
