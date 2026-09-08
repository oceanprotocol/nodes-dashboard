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
  /**
   * Fetch status is tracked per resource, not shared: the three endpoints are
   * independent, so one failing must not blank the others' state, and a
   * consumer needs to tell "request failed" apart from "no usage yet".
   */
  statsError: string | null;
  statsLoading: boolean;
  appPopularityError: string | null;
  appPopularityLoading: boolean;
  modelPopularityError: string | null;
  modelPopularityLoading: boolean;
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
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [appPopularityError, setAppPopularityError] = useState<string | null>(null);
  const [appPopularityLoading, setAppPopularityLoading] = useState<boolean>(false);
  const [modelPopularityError, setModelPopularityError] = useState<string | null>(null);
  const [modelPopularityLoading, setModelPopularityLoading] = useState<boolean>(false);

  const fetchServiceGlobalStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await axios.get<GlobalServiceStats>(getApiRoute('serviceGlobalStats'));
      if (response.data) {
        setStatsPerEpoch(response.data.data ?? []);
        setTotalServices(response.data.totalServices);
        setTotalServiceRevenue(response.data.totalServiceRevenue);
      }
      setStatsError(null);
    } catch (err) {
      console.error('Error fetching service global stats: ', err);
      setStatsError('Could not load inference stats.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchAppPopularity = useCallback(async () => {
    setAppPopularityLoading(true);
    try {
      const response = await axios.get<AppPopularity[]>(getApiRoute('appPopularity'), {
        params: { limit: POPULARITY_LIMIT },
      });
      setAppPopularity(Array.isArray(response.data) ? response.data : []);
      setAppPopularityError(null);
    } catch (err) {
      console.error('Error fetching app popularity: ', err);
      setAppPopularityError('Could not load app usage.');
    } finally {
      setAppPopularityLoading(false);
    }
  }, []);

  const fetchModelPopularity = useCallback(async () => {
    setModelPopularityLoading(true);
    try {
      const response = await axios.get<ModelPopularityResponse>(getApiRoute('modelPopularity'), {
        params: { limit: POPULARITY_LIMIT },
      });
      setModelPopularity(response.data?.data ?? []);
      setModelCoverage(response.data?.coverage ?? 0);
      setModelPopularityError(null);
    } catch (err) {
      console.error('Error fetching model popularity: ', err);
      setModelPopularityError('Could not load model usage.');
    } finally {
      setModelPopularityLoading(false);
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
        statsError,
        statsLoading,
        appPopularityError,
        appPopularityLoading,
        modelPopularityError,
        modelPopularityLoading,
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
