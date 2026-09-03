import { getApiRoute } from '@/config';
import {
  AppPopularity,
  GlobalServiceStats,
  ModelPopularity,
  ModelPopularityResponse,
  ServiceStatsPerEpoch,
} from '@/types/services-stats';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

const POPULARITY_LIMIT = 10;

type ServicesStatsContextType = {
  /**
   * One row per epoch, carrying BOTH the session count and the revenue — unlike
   * the jobs equivalent, nothing needs summing client-side, so a single array
   * feeds both charts.
   */
  statsPerEpoch: ServiceStatsPerEpoch[];
  totalServices: number;
  totalServiceRevenue: number;
  appPopularity: AppPopularity[];
  modelPopularity: ModelPopularity[];
  /** Share (0-1) of sessions that record a model at all. Surface it next to the chart. */
  modelCoverage: number;
  error: string | null;
  loading: boolean;
  fetchServiceGlobalStats: () => Promise<void>;
  fetchAppPopularity: () => Promise<void>;
  fetchModelPopularity: () => Promise<void>;
};

const ServicesStatsContext = createContext<ServicesStatsContextType | undefined>(undefined);

/**
 * Network-wide Service-on-Demand (inference) stats for the /stats page.
 *
 * Kept separate from StatsProvider rather than bolted onto it for two reasons:
 * that context has no loading/error state at all (every fetch just console.errors,
 * so a failure renders as an indistinguishable empty chart), and its `totalJobs`
 * is already written by several fetchers. A new provider avoids joining that pile.
 */
export const ServicesStatsProvider = ({ children }: { children: ReactNode }) => {
  const [statsPerEpoch, setStatsPerEpoch] = useState<ServiceStatsPerEpoch[]>([]);
  const [totalServices, setTotalServices] = useState<number>(0);
  const [totalServiceRevenue, setTotalServiceRevenue] = useState<number>(0);
  const [appPopularity, setAppPopularity] = useState<AppPopularity[]>([]);
  const [modelPopularity, setModelPopularity] = useState<ModelPopularity[]>([]);
  const [modelCoverage, setModelCoverage] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchServiceGlobalStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<GlobalServiceStats>(getApiRoute('serviceGlobalStats'));
      if (response.data) {
        setStatsPerEpoch(response.data.data ?? []);
        setTotalServices(response.data.totalServices);
        setTotalServiceRevenue(response.data.totalServiceRevenue);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching service global stats: ', err);
      setError('Could not load inference stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAppPopularity = useCallback(async () => {
    try {
      const response = await axios.get<AppPopularity[]>(getApiRoute('appPopularity'), {
        params: { limit: POPULARITY_LIMIT },
      });
      setAppPopularity(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching app popularity: ', err);
      setError('Could not load app popularity.');
    }
  }, []);

  const fetchModelPopularity = useCallback(async () => {
    try {
      const response = await axios.get<ModelPopularityResponse>(getApiRoute('modelPopularity'), {
        params: { limit: POPULARITY_LIMIT },
      });
      setModelPopularity(response.data?.data ?? []);
      setModelCoverage(response.data?.coverage ?? 0);
    } catch (err) {
      console.error('Error fetching model popularity: ', err);
      setError('Could not load model popularity.');
    }
  }, []);

  return (
    <ServicesStatsContext.Provider
      value={{
        statsPerEpoch,
        totalServices,
        totalServiceRevenue,
        appPopularity,
        modelPopularity,
        modelCoverage,
        error,
        loading,
        fetchServiceGlobalStats,
        fetchAppPopularity,
        fetchModelPopularity,
      }}
    >
      {children}
    </ServicesStatsContext.Provider>
  );
};

export const useServicesStatsContext = () => {
  const context = useContext(ServicesStatsContext);
  if (!context) {
    throw new Error('useServicesStatsContext must be used within a ServicesStatsProvider');
  }
  return context;
};
