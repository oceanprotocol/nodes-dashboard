import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { SelectedToken } from '@/context/run-job-context';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { HuggingFaceModel, ModelParameters } from '@/types/huggingface';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

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
};

const DEFAULT_JOB_DURATION_SECONDS = 3600;

const InferenceContext = createContext<InferenceContextType | undefined>(undefined);

export const InferenceProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedModels, setSelectedModels] = useState<HuggingFaceModel[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<SelectedInferenceEnv | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [hfToken, setHfToken] = useState<string>('');
  const [jobDurationSeconds, setJobDurationSeconds] = useState<number>(DEFAULT_JOB_DURATION_SECONDS);
  const [modelParamsByModel, setModelParamsByModel] = useState<Record<string, ModelParameters>>({});

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
