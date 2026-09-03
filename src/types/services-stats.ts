/**
 * Service-on-Demand (inference) statistics, as served by nodes-analytics under
 * `/services/*`.
 *
 * Two naming rules carried over from the API contract, both load-bearing for UI copy:
 *
 * 1. Every duration here is RESERVED (purchased) time, never served time — the
 *    node does not record how much of a paid window a container actually ran.
 *    Never label these "used", "served" or "consumed".
 * 2. `activeServices` answers two different questions depending on where it sits:
 *    at the top level it is sessions running RIGHT NOW; inside `data[]` it is
 *    sessions that OVERLAPPED that epoch. Do not reuse one label for both.
 */

/**
 * One epoch row, shared by the global, owner and node endpoints.
 *
 * Every field is always present — the Postgres columns are NOT NULL with a zero
 * default — so an epoch with no service activity arrives as zeros rather than
 * missing keys.
 */
export type ServiceStatsPerEpoch = {
  epochId: number;
  totalServices: number;
  /** Sessions that overlapped this epoch. NOT the same as the top-level activeServices. */
  activeServices: number;
  failedServices: number;
  serviceRevenue: number;
  reservedSeconds: number;
  uniqueConsumers: number;
  uniqueNodes: number;
};

/** GET /services/global-stats */
export type GlobalServiceStats = {
  data: ServiceStatsPerEpoch[];
  totalServices: number;
  totalServiceRevenue: number;
  totalReservedSeconds: number;
  failedServices: number;
  /** Sessions running right now. */
  activeServices: number;
  /** All-time distinct counts — not the sum of the per-epoch values. */
  uniqueConsumers: number;
  uniqueNodes: number;
};

/** GET /services/owners/:ownerId/stats */
export type OwnerServiceStats = {
  data: ServiceStatsPerEpoch[];
  totalServices: number;
  failedServices: number;
  serviceRevenue: number;
  reservedSeconds: number;
};

export type ServiceTermBucket = {
  key: string | number;
  count: number;
};

/** GET /services/nodes/:nodeId/stats */
export type NodeServiceStats = OwnerServiceStats & {
  runningNow: number;
  uniqueConsumers: number;
  byStatus: ServiceTermBucket[];
  byModel: ServiceTermBucket[];
};

export type ConsumerServiceStatsPerEpoch = {
  epochId: number;
  totalServices: number;
  paidAmount: number;
  reservedSeconds: number;
};

/**
 * GET /services/consumers/:consumerId/stats
 *
 * Computed live from Elasticsearch, and attributed differently from the node and
 * global rollups on purpose: a consumer cares when they PAID, so a session's
 * whole cost and duration land in its start epoch rather than being spread
 * across the weeks it ran.
 */
export type ConsumerServiceStats = {
  data: ConsumerServiceStatsPerEpoch[];
  totalServices: number;
  totalPaidAmount: number;
  reservedSeconds: number;
  activeServices: number;
  /** Running sessions whose expiresAt falls within the next 24h. */
  expiringSoon: number;
  avgDurationSeconds: number;
  avgCostUsdc: number;
};

type ServicePopularityFields = {
  sessions: number;
  revenue: number;
  reservedSeconds: number;
  nodesRunning: number;
  lastUsedAt: number | null;
};

/**
 * GET /services/app-popularity
 *
 * Keyed on the raw container image, so this counts APPS, not template variants —
 * every bundle runs its parent service's image. Label it "apps", not "templates".
 */
export type AppPopularity = ServicePopularityFields & {
  image: string;
};

export type ModelPopularity = ServicePopularityFields & {
  model: string;
};

/** GET /services/model-popularity */
export type ModelPopularityResponse = {
  data: ModelPopularity[];
  /**
   * Share (0-1) of sessions that record a model at all. Only launches made from
   * the dashboard do — the node's service listing strips dockerCmd, so CLI, MCP
   * and direct-node launches have none. Always surface this next to the chart.
   */
  coverage: number;
};
