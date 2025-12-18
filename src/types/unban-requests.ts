export interface UnbanRequestsResponse {
  requests: UnbanRequest[];
}

export type UnbanRequest = {
  index?: number;
  requestId: string;
  nodeId: string;
  jobId: string;
  status: string;
  benchmarkResult: any;
  startedAt: number;
  completedAt: number;
  errorMessage: string;
  attemptCount: number;
  epoch: number;
};
