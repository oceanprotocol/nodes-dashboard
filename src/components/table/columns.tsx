import InfoButton from '@/components/button/info-button';
import JobInfoButton from '@/components/button/job-info-button';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import ModelCell from '@/components/inference/model-cell';
import ServiceStatusChip, { JobStatusChip } from '@/components/service-status-chip/service-status-chip';
import { CHAIN_ID } from '@/constants/chains';
import { tokenAddressesByChainId } from '@/constants/tokens';
import { modelIdFromCommand } from '@/services/inference-launch';
import { isModelAppType, readServiceMetadata } from '@/services/service-metadata';
import { BenchmarkJobHistory, ComputeJob } from '@/types/jobs';
import { GPUPopularity, Node } from '@/types/nodes';
import { UnbanRequest } from '@/types/unban-requests';
import { calculateTotalBenchmarkScore } from '@/utils/benchmark-score';
import {
  formatAccessLists,
  formatBytes,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatWalletAddress,
  getJobDurationSeconds,
} from '@/utils/formatters';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Tooltip } from '@mui/material';
import { getGridNumericOperators, getGridStringOperators, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  NodeComputeJob,
  PersistentStorageBucket,
  PersistentStorageFileEntry,
  ServiceJob,
  ServiceJobListed,
} from '@oceanprotocol/lib';
import classNames from 'classnames';

function getUnbanAttemptResult(result: any) {
  if (result === null || result === undefined || result === '') {
    return (
      <>
        <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning-darker)' }} />
        <span>In progress</span>
      </>
    );
  }
  switch (result) {
    case 'Pending':
      return (
        <>
          <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning-darker)' }} />
          <span>Pending</span>
        </>
      );

    default:
      return (
        <>
          <HighlightOffOutlinedIcon style={{ fill: 'var(--error-darker)' }} />
          <span>Failed</span>
        </>
      );
  }
}

function getUnbanAttemptStatus(status: string) {
  return (
    <span
      className={classNames('chip', {
        chipSuccess: status === 'Finished',
        chipWarning: status === 'In queue',
        chipError: status === 'Failed',
      })}
      style={{ alignSelf: 'center' }}
    >
      {status}
    </span>
  );
}

function renderGpuList(gpus: GPUPopularity[]) {
  if (gpus?.length > 0) {
    const gpusFreq: Record<string, number> = {};
    for (const gpu of gpus) {
      const gpuLabel = `${gpu.vendor} ${gpu.name}`;
      gpusFreq[gpuLabel] = (gpusFreq[gpuLabel] || 0) + 1;
    }
    return (
      <div className="flexRow gapSm">
        {Object.entries(gpusFreq).map(([gpuLabel, count], index) => (
          <span className="flexRow alignItemsCenter gapXs" key={index}>
            {index > 0 && <span className="textSecondary">, </span>}
            <strong className="textSecondary">{count > 1 ? `${count}x ` : ''}</strong>
            <HardwareLabel type="gpu" value={gpuLabel} />
          </span>
        ))}
      </div>
    );
  }
  return '-';
}

export const actionsColumnProps: GridColDef = {
  align: 'right',
  field: '_actions',
  filterable: false,
  headerAlign: 'center',
  headerName: 'Actions',
  sortable: false,
};

export const nodesLeaderboardColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendlyName',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: true,
    filterOperators: getGridStringOperators().filter(
      (operator) => operator.value === 'contains' || operator.value === 'startsWith' || operator.value === 'equals'
    ),
    valueGetter: (_value, row) => row.friendlyName || row.id || row.nodeId,
    renderCell: (params) => <span title={params.value}>{params.value}</span>,
  },
  {
    field: 'gpus',
    filterable: false,
    flex: 1,
    headerName: 'GPUs',
    sortable: false,
    renderCell: ({ value }) => renderGpuList(value),
  },
  {
    field: 'latestBenchmarkResults.totalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total Score',
    sortable: true,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.totalScore,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: (params) => (
      <div className="flexRow alignItemsCenter gapSm">
        {params.row.verified ? (
          <VerifiedIcon className="textSuccessDarker" />
        ) : (
          <HighlightOffOutlinedIcon className="textError" />
        )}
        {params.value || params.value === 0 ? (
          <span>{params.value.toLocaleString()}</span>
        ) : (
          <span className="textErrorDarker">Not verified</span>
        )}
      </div>
    ),
  },
  {
    field: 'location.region',
    filterable: true,
    flex: 1,
    headerName: 'Region',
    valueGetter: (_value, row) => row.location?.region,
    sortable: false,
    filterOperators: getGridStringOperators().filter(
      (operator) => operator.value === 'contains' || operator.value === 'startsWith' || operator.value === 'equals'
    ),
    renderCell: (params) => params.value || <span className="textSecondary">Unknown</span>,
  },

  {
    field: 'ipAndDns.dns',
    filterable: false,
    flex: 1,
    headerName: 'DNS',
    sortable: false,
    valueGetter: (_value, row) => row.ipAndDns?.dns,
  },
  {
    field: 'ipAndDns.ip',
    filterable: false,
    flex: 1,
    headerName: 'IP',
    sortable: true,
    valueGetter: (_value, row) => row.ipAndDns?.ip,
  },
  {
    field: 'ipAndDns.port',
    filterable: false,
    flex: 1,
    headerName: 'Port',
    sortable: true,
    valueGetter: (_value, row) => row.ipAndDns?.port,
  },
  {
    align: 'right',
    field: 'actions',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Actions',
    sortable: false,
    renderCell: (params) => {
      return <InfoButton node={params.row} />;
    },
  },
];

export const NodesLeaderboardColumnsVisibility = {
  'ipAndDns.dns': false,
  'ipAndDns.ip': false,
  'ipAndDns.port': false,
};

export const nodesLeaderboardHomeColumns: GridColDef<Node>[] = [
  {
    field: 'friendlyName',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: false,
    valueGetter: (_value, row) => row.friendlyName || row.id || row.nodeId,
    renderCell: (params) => <span title={params.value}>{params.value}</span>,
  },
  {
    field: 'gpus',
    filterable: false,
    flex: 1,
    headerName: 'GPUs',
    sortable: false,
    renderCell: ({ value }) => renderGpuList(value),
  },
  {
    field: 'latestBenchmarkResults.totalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total score',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.totalScore,
    renderCell: (params) => (
      <div className="flexRow alignItemsCenter gapSm">
        <div className="flexRow alignItemsCenter gapSm">
          {params.row.verified ? (
            <VerifiedIcon className="textSuccessDarker" />
          ) : (
            <HighlightOffOutlinedIcon className="textError" />
          )}
          {params.value || params.value === 0 ? (
            <span>{params.value.toLocaleString()}</span>
          ) : (
            <span className="textErrorDarker">Not verified</span>
          )}
        </div>
      </div>
    ),
  },
  {
    field: 'totalJobs',
    filterable: false,
    flex: 1,
    headerName: 'Total jobs',
    sortable: false,
    valueGetter: (_value, row) => row.totalJobs || 0,
  },
  {
    field: 'totalRevenue',
    filterable: false,
    flex: 1,
    headerName: 'Revenue',
    sortable: false,
    valueGetter: (_value, row) => `USDC ${formatNumber(row.totalRevenue || 0)}`,
  },
];

export const nodesTopByRevenueColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendlyName',
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: false,
    valueGetter: (_value, row) => row.friendlyName || row.id || row.nodeId,
    renderCell: (params) => <span title={params.value}>{params.value}</span>,
  },
  {
    field: 'region',
    filterable: false,
    flex: 1,
    headerName: 'Region',
    valueGetter: (_value, row) => row.region,
    sortable: false,
    renderCell: (params) => params.value || <span className="textSecondary">Unknown</span>,
  },
  {
    field: 'totalRevenue',
    filterable: false,
    flex: 1,
    headerName: 'Revenue',
    sortable: false,
    valueGetter: (_value, row) => `USDC ${formatNumber(row.totalRevenue || 0)}`,
  },
  {
    field: 'latestTotalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total score',
    sortable: false,
    valueGetter: (_value, row) => row.latestTotalScore || 0,
    renderCell: (params) => (
      <div className="flexRow alignItemsCenter gapSm">
        {params.value ? (
          <>
            <VerifiedIcon className="textSuccessDarker" />
            <span>{params.value.toLocaleString()}</span>
          </>
        ) : (
          <>
            <HighlightOffOutlinedIcon className="textError" />
            <span className="textErrorDarker">Not verified</span>
          </>
        )}
      </div>
    ),
  },
];

export const nodesTopByJobCountColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendlyName',
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: false,
    valueGetter: (_value, row) => row.friendlyName || row.id || row.nodeId,
    renderCell: (params) => <span title={params.value}>{params.value}</span>,
  },
  {
    field: 'region',
    filterable: false,
    flex: 1,
    headerName: 'Region',
    valueGetter: (_value, row) => row.region,
    sortable: false,
    renderCell: (params) => params.value || <span className="textSecondary">Unknown</span>,
  },
  {
    field: 'totalJobs',
    filterable: false,
    flex: 1,
    headerName: 'Total jobs',
    sortable: false,
    valueGetter: (_value, row) => row.totalJobs || 0,
  },
  {
    field: 'latestTotalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total score',
    sortable: false,
    valueGetter: (_value, row) => row.latestTotalScore || 0,
    renderCell: (params) => (
      <div className="flexRow alignItemsCenter gapSm">
        {params.value ? (
          <>
            <VerifiedIcon className="textSuccessDarker" />
            <span>{params.value.toLocaleString()}</span>
          </>
        ) : (
          <>
            <HighlightOffOutlinedIcon className="textError" />
            <span className="textErrorDarker">Not verified</span>
          </>
        )}
      </div>
    ),
  },
];

// Amount paid, rendered as "<amount> <TOKEN>". The record stores the payment token by address, so the
// symbol is recovered from the chain's token list; an unknown token falls back to the bare amount.
/**
 * Everything actually paid for a service: the initial start payment plus one entry per successful
 * SERVICE_EXTEND. Reading `payment.cost` alone understated every prolonged service — a 10-minute
 * service extended to 20 showed the 10-minute price against a "20 m" duration.
 *
 * Costs come off the wire as string|number, so each is coerced and non-numeric entries skipped rather
 * than poisoning the sum with NaN. Returns undefined when there is nothing to show, which is what
 * renderAmountPaid treats as "-" — distinct from a real 0.
 */
function totalAmountPaid(payment?: { cost?: string | number }, extendPayments?: { cost?: string | number }[]) {
  const amounts = [payment?.cost, ...(extendPayments ?? []).map((extend) => extend?.cost)]
    .map((cost) => (cost === undefined || cost === null || cost === '' ? NaN : Number(cost)))
    .filter((cost) => Number.isFinite(cost));
  return amounts.length > 0 ? amounts.reduce((sum, cost) => sum + cost, 0) : undefined;
}

function renderAmountPaid(cost?: string | number, token?: string) {
  if (cost === undefined || cost === null || cost === '') {
    return '-';
  }
  const tokenEntry = Object.entries(tokenAddressesByChainId[CHAIN_ID]).find(
    ([, t]) => t.address.toLowerCase() === token?.toLowerCase()
  );
  const formattedAmount = formatNumber(cost);
  if (!tokenEntry) {
    return formattedAmount;
  }
  return `${formattedAmount} ${tokenEntry[0]}`;
}

export const jobsColumns: GridColDef<ComputeJob>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'metadata.name',
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: false,
    valueGetter: (_value, row) => row.metadata?.name,
    renderCell: ({ value }) => <span title={value}>{value || '-'}</span>,
  },
  {
    field: 'statusText',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: ({ value, row }) => {
      if (!value) return '-';
      switch (value) {
        case 'pending':
          return <span className="chip chipWarning">Pending</span>;
        case 'running':
          return <span className="chip chipWarning">Running</span>;
        case 'completed':
          return <span className="textSuccessDarker">Completed</span>;
        case 'failed':
          return (
            <span className="textBold textErrorDarker">
              Failed
              {'errorMessage' in row && row.errorMessage ? (
                <>
                  {' '}
                  <Tooltip title={row.errorMessage}>
                    <InfoOutlinedIcon />
                  </Tooltip>
                </>
              ) : null}
            </span>
          );
        case 'timeout':
          return <span className="textBold textErrorDarker">Timed out</span>;
        default:
          return value;
      }
    },
  },
  {
    field: 'dateCreated',
    filterable: true,
    flex: 1,
    headerName: 'Start time',
    sortable: true,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      return formatDateTime(value);
    },
  },
  {
    field: 'payment.cost',
    filterable: true,
    flex: 1,
    headerName: 'Amount paid',
    sortable: true,
    valueGetter: (_value, row) => row.payment?.cost,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ row }) => renderAmountPaid(row.payment?.cost, row.payment?.token),
  },
  {
    field: 'algoDuration',
    filterable: true,
    flex: 1,
    headerName: 'Duration',
    sortable: true,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    valueGetter: (_value, row) => getJobDurationSeconds(row),
    renderCell: ({ value }) => (value == null ? '-' : formatDuration(value, true)),
  },
  {
    align: 'right',
    field: 'actions',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Actions',
    sortable: false,
    renderCell: (params: GridRenderCellParams<ComputeJob>) => {
      return <JobInfoButton job={params.row} />;
    },
  },
];

export const benchmarkJobsColumns: GridColDef<BenchmarkJobHistory>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'statusText',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: ({ value, row }) => {
      if (!value) return '-';
      switch (value) {
        case 'pending':
          return <span className="chip chipWarning">Pending</span>;
        case 'running':
          return <span className="chip chipWarning">Running</span>;
        case 'completed':
          return <span className="textSuccessDarker">Completed</span>;
        case 'failed':
          return (
            <span className="textBold textErrorDarker">
              Failed
              {'errorMessage' in row && row.errorMessage ? (
                <>
                  {' '}
                  <Tooltip title={row.errorMessage}>
                    <InfoOutlinedIcon />
                  </Tooltip>
                </>
              ) : null}
            </span>
          );
        case 'timeout':
          return <span className="textBold textErrorDarker">Timed out</span>;
        default:
          return value;
      }
    },
  },
  {
    field: 'startTime',
    filterable: true,
    flex: 1,
    headerName: 'Start Time',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'amountPaid',
    filterable: true,
    flex: 1,
    headerName: 'Amount Paid',
    sortable: false,
    valueGetter: (_value, row) => row.paymentInfo?.cost,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      return formatNumber(value);
    },
  },
  {
    field: 'algoDuration',
    filterable: true,
    flex: 1,
    headerName: 'Duration',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      if (value < 60) return `${value.toFixed(2)}s`;
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(0);
      return `${mins}m ${secs}s`;
    },
  },
  {
    field: 'gpuScore',
    filterable: false,
    flex: 1,
    headerName: 'GPU Score',
    sortable: false,
    valueGetter: (_value, row) => row.benchmarkResults?.gpuScore,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return Math.round(value).toLocaleString();
    },
  },
  {
    field: 'cpuScore',
    filterable: false,
    flex: 1,
    headerName: 'CPU Score',
    sortable: false,
    valueGetter: (_value, row) => row.benchmarkResults?.cpuScore,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return Math.round(value).toLocaleString();
    },
  },
  {
    field: 'bandwidthScore',
    filterable: false,
    flex: 1,
    headerName: 'Bandwidth Score',
    sortable: false,
    valueGetter: (_value, row) => row.benchmarkResults?.bandwidthScore,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return Math.round(value).toLocaleString();
    },
  },
  {
    field: 'totalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total Score',
    sortable: false,
    valueGetter: (_value, row) =>
      calculateTotalBenchmarkScore(
        row.benchmarkResults?.gpuScore,
        row.benchmarkResults?.cpuScore,
        row.benchmarkResults?.bandwidthScore
      ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      return Math.round(value).toLocaleString();
    },
  },
];

export const unbanRequestsColumns: GridColDef<UnbanRequest>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'status',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: (params: GridRenderCellParams<UnbanRequest>) => getUnbanAttemptStatus(params.row.status),
  },
  {
    field: 'startedAt',
    filterable: false,
    flex: 1,
    headerName: 'Start Time',
    sortable: false,
    renderCell: ({ value }) => formatDateTime(value / 1000),
  },
  {
    field: 'completedAt',
    filterable: false,
    flex: 1,
    headerName: 'End Time',
    sortable: false,
    renderCell: ({ value }) => formatDateTime(value / 1000),
  },
  {
    field: 'benchmarkResult',
    filterable: false,
    flex: 1,
    headerName: 'Result',
    sortable: false,
    renderCell: (params: GridRenderCellParams<UnbanRequest>) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {getUnbanAttemptResult(params.row.benchmarkResult)}
      </div>
    ),
  },
];

// The model a service serves, or null when it serves none.
//
// The service's own `appType`/`appId` labels answer directly when it has them — including "this runs a
// template, so there is no model" (see service-metadata). Otherwise the node returns the launch
// command, not HF metadata, so the id is recovered from it (`--model` on vLLM, `-hf` on llama.cpp;
// see modelIdFromCommand).
export function modelIdFromJob(job: ServiceJob): string | null {
  const identity = readServiceMetadata(job);
  if (identity) {
    return isModelAppType(identity.appType) ? identity.appId : null;
  }
  return modelIdFromCommand(job.dockerCmd);
}

// The caller's own inference services (getServiceStatus keeps dockerCmd, so the model id is
// recoverable). Actions column (Manage) is supplied by the consumer via the Table `actionsColumn`.
// `templateName` is set by the consumer for a service launched from an app template: those carry no
// HF model (the app rides in the template's own image/command), so the row names the app instead.
// `templatePending` marks a modelless row whose template lookup is still in flight — it shimmers
// rather than claiming "Unknown model" for a name that's about to arrive.
export const existingServicesColumns: GridColDef<
  ServiceJob & { templateName?: string; templatePending?: boolean; templateNameApproximate?: boolean }
>[] =
  [
    {
      field: 'model',
      filterable: false,
      flex: 1.5,
      headerName: 'Model',
      sortable: false,
      renderCell: ({ row }) => {
        if (row.templateName) {
          // Template names read as "vLLM — two lite models on one small GPU": headline before the dash,
          // the rest as the caption, so the cell keeps the same two-line shape as a model row.
          //
          // An approximate name is already just the family headline (see appFamilyName) and carries no
          // caption to split off — the variant is unknown, so the row says the app and stops there.
          const [headline, ...rest] = row.templateName.split(/\s+[—–-]\s+/);
          return (
            <ModelCell
              subtitle={row.templateNameApproximate ? undefined : rest.join(' — ') || undefined}
              title={headline}
            />
          );
        }
        const modelId = modelIdFromJob(row);
        if (modelId) {
          return <ModelCell modelId={modelId} />;
        }
        if (row.templatePending) {
          return <ModelCell loading />;
        }
        // No `--model` in the launch command (e.g. a malformed record from an earlier run) — there's no
        // model to name, so say so rather than showing a serviceId fragment that reads like a model id.
        return (
          <span className="textSecondary" title={`Service ${row.serviceId}`}>
            Unknown model
          </span>
        );
      },
    },
    {
      field: 'statusText',
      filterable: false,
      flex: 1,
      headerName: 'Status',
      sortable: false,
      renderCell: ({ row }) => <ServiceStatusChip status={row.status} statusText={row.statusText} />,
    },
    {
      field: 'dateCreated',
      filterable: false,
      flex: 1,
      headerName: 'Created',
      sortable: true,
      renderCell: ({ value }) => {
        if (!value) return '-';
        return formatDateTime(Math.floor(new Date(value).getTime() / 1000));
      },
    },
    {
      field: 'duration',
      filterable: false,
      flex: 1,
      headerName: 'Duration',
      sortable: true,
      renderCell: ({ value }) => (value ? formatDuration(value, true) : '-'),
    },
    {
      field: 'expiresAt',
      filterable: false,
      flex: 1,
      headerName: 'End time',
      sortable: true,
      renderCell: ({ value }) => (value ? formatDateTime(value / 1000) : '-'),
    },
    // "Amount paid" is hidden until the backend keeps the cost in step with the duration.
    //
    // This row is served entirely by the incentive-backend (see existing-services-table's single GET
    // to /owners/:address/services) and `payment.cost` there is written once, at launch. A prolong
    // pays again through SERVICE_EXTEND, and the monitor's reconcile refreshes `duration` from the
    // node — but nothing updates the cost, and the backend records no `extendPayments` at all. So a
    // 10-minute service extended to 20 rendered "20 m" beside the 10-minute price: understated, and
    // wrong in the direction that matters.
    //
    // Nothing client-side can repair that (the summing helper below is kept for whenever the field
    // arrives), so the honest option is to show no figure rather than a low one. Restore this column
    // once the backend updates the cost alongside the duration — ideally recording each extension the
    // way /services/:serviceId/started and /restarted already record their events.
    // {
    //   field: 'payment.cost',
    //   filterable: false,
    //   flex: 1,
    //   headerName: 'Amount paid',
    //   sortable: true,
    //   // Start payment PLUS every extension — a prolonged service has paid more than `payment.cost`.
    //   valueGetter: (_value, row) => totalAmountPaid(row.payment, row.extendPayments),
    //   renderCell: ({ row }) => renderAmountPaid(totalAmountPaid(row.payment, row.extendPayments), row.payment?.token),
    // },
  ];

// An env id is a hyphen-joined list of addresses; render each shortened, joined with ' - '.
function renderEnvironment(value?: string) {
  if (!value) {
    return <span className="textSecondary">-</span>;
  }
  return (
    <span title={value}>
      {value
        .split('-')
        .map((v) => formatWalletAddress(v))
        .join(' - ')}
    </span>
  );
}

// Services running on a node, listed node-wide across all owners (ProviderInstance.getServices).
// The listed shape strips dockerCmd/dockerfile, so identity is the container image, not the model.
export const nodeServicesColumns: GridColDef<ServiceJobListed>[] = [
  {
    field: 'image',
    filterable: true,
    flex: 1,
    headerName: 'Image',
    sortable: true,
    filterOperators: getGridStringOperators().filter(
      (operator) => operator.value === 'contains' || operator.value === 'startsWith' || operator.value === 'equals'
    ),
    valueGetter: (_value, row) => (row.tag ? `${row.image}:${row.tag}` : row.image),
    renderCell: ({ value }) => <span title={value}>{value || '-'}</span>,
  },
  {
    field: 'owner',
    filterable: true,
    flex: 1,
    headerName: 'Owner',
    sortable: false,
    filterOperators: getGridStringOperators().filter(
      (operator) => operator.value === 'contains' || operator.value === 'equals'
    ),
    renderCell: ({ value }) => (value ? <span title={value}>{formatWalletAddress(value)}</span> : '-'),
  },
  {
    field: 'environment',
    filterable: false,
    flex: 1,
    headerName: 'Environment',
    sortable: false,
    renderCell: ({ value }) => renderEnvironment(value),
  },
  {
    field: 'statusText',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: ({ row }) => <ServiceStatusChip status={row.status} statusText={row.statusText} />,
  },
  {
    field: 'dateCreated',
    filterable: false,
    flex: 1,
    headerName: 'Start time',
    sortable: true,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return formatDateTime(Math.floor(new Date(value).getTime() / 1000));
    },
  },
  {
    field: 'duration',
    filterable: false,
    flex: 1,
    headerName: 'Duration',
    sortable: true,
    renderCell: ({ value }) => (value ? formatDuration(value, true) : '-'),
  },
  {
    field: 'expiresAt',
    filterable: false,
    flex: 1,
    headerName: 'End time',
    sortable: true,
    renderCell: ({ value }) => (value ? formatDateTime(value / 1000) : '-'),
  },
];

// Compute jobs running on a node, listed node-wide across all owners (ProviderInstance.getNodeJobs).
export const nodeJobsColumns: GridColDef<NodeComputeJob>[] = [
  {
    field: 'name',
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: false,
    valueGetter: (_value, row) => row.metadata?.name,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return value;
    },
  },
  {
    field: 'owner',
    filterable: true,
    flex: 1,
    headerName: 'Owner',
    sortable: false,
    filterOperators: getGridStringOperators().filter(
      (operator) => operator.value === 'contains' || operator.value === 'equals'
    ),
    renderCell: ({ value }) => (value ? <span title={value}>{formatWalletAddress(value)}</span> : '-'),
  },
  {
    field: 'environment',
    filterable: false,
    flex: 1,
    headerName: 'Environment',
    sortable: false,
    renderCell: ({ value }) => renderEnvironment(value),
  },
  {
    field: 'statusText',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: ({ row }) => <JobStatusChip status={row.status} statusText={row.statusText} />,
  },
  {
    field: 'dateCreated',
    filterable: false,
    flex: 1,
    headerName: 'Start time',
    sortable: true,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return formatDateTime(Math.floor(new Date(value).getTime() / 1000));
    },
  },
  {
    field: 'algoDuration',
    filterable: false,
    flex: 1,
    headerName: 'Duration',
    sortable: true,
    renderCell: ({ value }) => (value ? formatDuration(value, true) : '-'),
  },
];

export const topNodesByRevenueColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendlyName',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: false,
  },
  {
    field: 'region',
    filterable: true,
    flex: 1,
    headerName: 'Region',
    sortable: false,
  },
  {
    field: 'totalRevenue',
    filterable: false,
    renderCell: ({ value }) => formatNumber(value.toFixed(2)),
    flex: 1,
    headerName: 'Total Revenue',
    sortable: false,
  },
  {
    field: 'latestGpuScore',
    filterable: false,
    flex: 1,
    headerName: 'Last benchmark score (GPU)',
    sortable: false,
  },
];

export const topNodesByJobsColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendlyName',
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: true,
  },
  {
    field: 'region',
    filterable: false,
    flex: 1,
    headerName: 'Region',
    sortable: true,
  },
  {
    field: 'totalJobs',
    filterable: false,
    flex: 1,
    headerName: 'Total Jobs',
    sortable: true,
  },
  {
    field: 'latestGpuScore',
    filterable: false,
    flex: 1,
    headerName: 'Last benchmark score (GPU)',
    sortable: false,
  },
];

export const nodeStorageMyBucketsColumns: GridColDef<PersistentStorageBucket>[] = [
  {
    field: 'label',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: true,
    valueGetter: (_value, row) => row.label?.trim() || row.bucketId,
  },
  {
    field: 'bucketId',
    filterable: true,
    flex: 1,
    headerName: 'Bucket ID',
    sortable: false,
  },
  {
    field: 'createdAt',
    filterable: false,
    headerName: 'Created',
    sortable: true,
    width: 160,
    renderCell: ({ value }) => formatDateTime(value),
  },
  {
    field: 'accessLists',
    filterable: false,
    flex: 1,
    headerName: 'Access list',
    sortable: false,
    renderCell: ({ value }) => {
      if (!value?.length) {
        return <span className="textSecondary">Owner-only (no access list)</span>;
      }
      return formatAccessLists(value, { shortenAddresses: true }).join(', ');
    },
  },
];

export const nodeStorageSharedBucketsColumns: GridColDef<PersistentStorageBucket>[] = [
  {
    field: 'bucketId',
    filterable: true,
    flex: 1,
    headerName: 'Bucket ID',
    sortable: false,
  },
  {
    field: 'createdAt',
    filterable: false,
    headerName: 'Created',
    sortable: true,
    width: 160,
    renderCell: ({ value }) => formatDateTime(value),
  },
  {
    field: 'owner',
    filterable: false,
    headerName: 'Owner',
    sortable: false,
    width: 160,
    renderCell: ({ value }) => formatWalletAddress(value),
  },
];

export const nodeStorageFilesColumns: GridColDef<PersistentStorageFileEntry>[] = [
  {
    field: 'name',
    filterable: false,
    flex: 1,
    headerName: 'File name',
    sortable: false,
  },
  {
    field: 'size',
    filterable: false,
    headerName: 'File size',
    sortable: false,
    align: 'right',
    headerAlign: 'right',
    renderCell: ({ value }) => formatBytes(value as number),
  },
  {
    field: 'lastModified',
    filterable: false,
    headerName: 'Last modified',
    sortable: true,
    width: 160,
    renderCell: ({ value }) => formatDateTime(value / 1000),
  },
];
