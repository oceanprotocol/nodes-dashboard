import { CHAIN_ID } from '@/constants/chains';
import { USDC } from '@/constants/tokens';
import { captureError, getHttpStatus } from '@/lib/analytics';
import type { InferenceBranch } from '@/lib/inference-analytics';
import { serviceEscrowJobId } from '@/lib/service-escrow-lock';
import { getSubsidyJobTypeName, JobSubsidy, SubsidyJobType, SubsidyLineKind } from '@/lib/subsidy';
import type { ComputeJobPayment, NodeComputeJob, ServiceJob } from '@oceanprotocol/lib';
import posthog from 'posthog-js';

/**
 * PostHog events for paid job starts and prolongs, compute and service. `useStartWithSubsidy` sends them, since every
 * call that locks escrow goes through it.
 *
 * - `job_payment_accepted`: the node accepted a paid start or prolong, subsidized or not. One per payment.
 * - `job_payment_failed`: the paid node call threw, or resolved with something that isn't a job.
 *
 * Both carry the payment context and the subsidy quote taken at start (`buildPaymentProps`). Amounts are quotes in
 * USDC: ON subsidy providers are postpaid, so what they actually pay settles on-chain when the node claims.
 * `job_payment_accepted` adds `subsidyStatus` (`deriveSubsidyStatus`), the node's own provider list, and the escrow
 * jobId that joins the payment to its on-chain lock.
 */

export type PaymentAction = 'prolong' | 'start';

/** What the dashboard knows about a paid start or prolong before calling the node. */
export type PaidStartContext = {
  action: PaymentAction;
  branch?: InferenceBranch;
  /** Gross cost in USDC before any subsidy: the amount the payment step showed. */
  cost: number;
  /** For a prolong, the extra seconds. */
  durationSeconds: number;
  environmentId: string;
  /** Whether the ON subsidy covers this kind of job. Custom subsidies are quoted either way. */
  isOpfEligible: boolean;
  jobType: SubsidyJobType;
  /** The environment's consumerAddress: the escrow payee, and the node the subsidy was quoted for. */
  nodeAddress: string;
  nodeId: string;
  payer: string;
  /** Prolong only. A service start learns its id from the node's reply. */
  serviceId?: string;
};

export type ValidPaymentReply = {
  claimTx?: string;
  /** Decimal uint256 the escrow locks the payment under, as in `EscrowEventRecord.jobId`. */
  escrowJobId?: string;
  jobId?: string;
  lockTx?: string;
  /** The reply comes from an ocean-node that honours subsidy provider lists (v5+). */
  nodeSubsidyAware: boolean;
  /** The providers the node used for this payment, lowercase. `null` when the reply doesn't say. */
  nodeSubsidyProviders: string[] | null;
  serviceId?: string;
  valid: true;
};

export type PaymentReply = ValidPaymentReply | { reason: string; valid: false };

export type SubsidyStatus = 'not_subsidized' | 'subsidized' | 'unknown';

/**
 * A COMPUTE_START reply as ocean-node v5 sends it. ocean.js types `computeStart` as `ComputeJob`, without the escrow
 * fields; at runtime the job also carries `jobIdHash` and `payment.subsidyProviders`, the node's effective list.
 */
type ComputeStartReply = NodeComputeJob & { payment?: ComputeJobPayment & { subsidyProviders?: unknown } };

const REASON_MAX_LENGTH = 300;
const QUOTE_ERROR_MAX_LENGTH = 200;

const firstOf = (result: unknown): unknown => (Array.isArray(result) ? result[0] : result);

const asObject = <T>(value: unknown): Partial<T> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<T>) : null;

const nonEmptyString = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

const toAddressList = (value: unknown): string[] | null =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((address) => address.toLowerCase())
    : null;

const toDecimalJobId = (hash: unknown): string | undefined =>
  typeof hash === 'string' && /^0x[0-9a-f]{1,64}$/i.test(hash) ? BigInt(hash).toString() : undefined;

/** On its last retry, ocean.js v10's P2P transport resolves with the relay's error reply instead of throwing. */
const invalidReply = (result: unknown): PaymentReply => {
  const reply = firstOf(result);
  const error = asObject<{ error: unknown }>(reply)?.error;
  const reason =
    typeof reply === 'string'
      ? reply
      : typeof error === 'string'
        ? error
        : Array.isArray(result) && result.length === 0
          ? 'Empty node reply'
          : 'Unexpected node reply';
  return { reason: reason.slice(0, REASON_MAX_LENGTH), valid: false };
};

export const parseComputeStartReply = (result: unknown): PaymentReply => {
  const job = asObject<ComputeStartReply>(firstOf(result));
  const jobId = nonEmptyString(job?.jobId);
  if (!job || !jobId) {
    return invalidReply(result);
  }
  const nodeSubsidyProviders = toAddressList(job.payment?.subsidyProviders);
  return {
    escrowJobId: toDecimalJobId(job.jobIdHash),
    jobId,
    lockTx: nonEmptyString(job.payment?.lockTx),
    nodeSubsidyAware: nodeSubsidyProviders !== null,
    nodeSubsidyProviders,
    valid: true,
  };
};

/** The node locks a new service's payment in the background, after replying. */
export const parseServiceStartReply = (result: unknown): PaymentReply => {
  const job = asObject<ServiceJob>(firstOf(result));
  const serviceId = nonEmptyString(job?.serviceId);
  if (!job || !serviceId) {
    return invalidReply(result);
  }
  const nodeSubsidyProviders = toAddressList(job.payment?.subsidyProviders);
  return {
    escrowJobId: serviceEscrowJobId(serviceId),
    nodeSubsidyAware: nodeSubsidyProviders !== null,
    nodeSubsidyProviders,
    serviceId,
    valid: true,
  };
};

/** The node locks and claims an extension before replying, so a valid reply ends with a claimed `extendPayments` entry. */
export const parseServiceExtendReply =
  (serviceId: string) =>
  (result: unknown): PaymentReply => {
    const job = asObject<ServiceJob>(firstOf(result));
    const extendPayments = job?.extendPayments;
    const extension = Array.isArray(extendPayments)
      ? asObject<{ claimTx: unknown; lockTx: unknown }>(extendPayments[extendPayments.length - 1])
      : null;
    const claimTx = nonEmptyString(extension?.claimTx);
    if (!job || job.serviceId !== serviceId || !claimTx) {
      return invalidReply(result);
    }
    return {
      claimTx,
      escrowJobId: serviceEscrowJobId(serviceId),
      lockTx: nonEmptyString(extension?.lockTx),
      // The reply's `payment` is the service's start payment, so it only tells which node version created the service.
      nodeSubsidyAware: Array.isArray(job.payment?.subsidyProviders),
      nodeSubsidyProviders: null,
      serviceId,
      valid: true,
    };
  };

/** A parser bug must not break the payment, so it counts as an invalid reply. */
export const safeParseReply = (parse: (result: unknown) => PaymentReply, result: unknown): PaymentReply => {
  try {
    return parse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { reason: `Reply parser failed: ${message}`.slice(0, REASON_MAX_LENGTH), valid: false };
  }
};

const sameAddresses = (a: string[], b: string[]) => {
  const left = new Set(a.map((address) => address.toLowerCase()));
  const right = new Set(b.map((address) => address.toLowerCase()));
  return left.size === right.size && [...left].every((address) => right.has(address));
};

/**
 * Whether the payment was subsidized, as far as the dashboard can tell when the node accepts it.
 * - `subsidized`: the dashboard quoted a subsidy, and the node confirmed it uses the providers sent. For a prolong,
 *   confirmed means the service was created by a node that honours provider lists.
 * - `not_subsidized`: nothing was quoted, and the node either can't subsidize (older than v5), was told to apply no
 *   subsidy, used no providers, or only used providers the dashboard had asked and that quoted nothing.
 * - `unknown`: anything else, e.g. a quoted subsidy on a node that ignores provider lists.
 */
export const deriveSubsidyStatus = (
  action: PaymentAction,
  subsidy: JobSubsidy,
  reply: ValidPaymentReply
): SubsidyStatus => {
  if (subsidy.status === 'covered') {
    if (action === 'prolong') {
      return reply.nodeSubsidyAware ? 'subsidized' : 'unknown';
    }
    return reply.nodeSubsidyProviders && sameAddresses(reply.nodeSubsidyProviders, subsidy.providers ?? [])
      ? 'subsidized'
      : 'unknown';
  }
  // The node got no list, so it used its own configured providers if it supports any, or an empty list (no subsidy).
  if (!reply.nodeSubsidyAware) {
    return 'not_subsidized';
  }
  if (action === 'prolong') {
    // An extension's providers aren't in the reply. An empty list rules a subsidy out; with `not_covered`, every
    // provider asked quoted nothing.
    return subsidy.providers?.length === 0 || subsidy.status === 'not_covered' ? 'not_subsidized' : 'unknown';
  }
  const asked = new Set(subsidy.quote?.quotedProviders.map((address) => address.toLowerCase()));
  return (reply.nodeSubsidyProviders ?? []).every((address) => asked.has(address)) ? 'not_subsidized' : 'unknown';
};

const KIND_ORDER: SubsidyLineKind[] = ['one_time', 'discount', 'custom'];

const toUsdc = (amount: number) => Number(amount.toFixed(USDC.decimals));

/** Shared by both events. Amounts are always numbers (0, never undefined), so PostHog types them as numeric. */
export const buildPaymentProps = (context: PaidStartContext, subsidy: JobSubsidy) => {
  const lines = subsidy.quote?.lines ?? [];
  const amountOf = (kind: SubsidyLineKind) =>
    toUsdc(lines.filter((line) => line.kind === kind).reduce((total, line) => total + line.amount, 0));
  const kinds = KIND_ORDER.filter((kind) => lines.some((line) => line.kind === kind));
  return {
    action: context.action,
    branch: context.branch,
    chainId: CHAIN_ID,
    durationSeconds: context.durationSeconds,
    environmentId: context.environmentId,
    isOpfEligible: context.isOpfEligible,
    jobType: getSubsidyJobTypeName(context.jobType),
    nodeAddress: context.nodeAddress.toLowerCase(),
    nodeId: context.nodeId,
    payer: context.payer.toLowerCase(),
    // `none`: an empty list was sent, which tells the node to apply no subsidy.
    providerSelection: !subsidy.providers ? 'node_default' : subsidy.providers.length > 0 ? 'explicit' : 'none',
    quoteError: subsidy.error?.slice(0, QUOTE_ERROR_MAX_LENGTH),
    quoteStatus: subsidy.status,
    quotedCost: toUsdc(context.cost),
    quotedCustomAmount: amountOf('custom'),
    quotedDiscountAmount: amountOf('discount'),
    quotedOneTimeAmount: amountOf('one_time'),
    quotedPostpaidAmount: toUsdc(subsidy.quote?.postpaid ?? 0),
    quotedSubsidyAmount: toUsdc(subsidy.quote?.total ?? 0),
    serviceId: context.serviceId,
    subsidyKinds: kinds.length > 0 ? kinds.join('+') : 'none',
    subsidyLines: lines.map((line) => ({
      amount: toUsdc(line.amount),
      kind: line.kind,
      payment: line.payment,
      provider: line.address.toLowerCase(),
    })),
    subsidyProviders: (subsidy.providers ?? []).map((address) => address.toLowerCase()),
  };
};

export const capturePaymentAccepted = (context: PaidStartContext, subsidy: JobSubsidy, reply: ValidPaymentReply) => {
  try {
    posthog.capture('job_payment_accepted', {
      ...buildPaymentProps(context, subsidy),
      claimTx: reply.claimTx,
      escrowJobId: reply.escrowJobId,
      jobId: reply.jobId,
      lockTx: reply.lockTx,
      nodeSubsidyProviders: reply.nodeSubsidyProviders,
      serviceId: reply.serviceId ?? context.serviceId,
      subsidyStatus: deriveSubsidyStatus(context.action, subsidy, reply),
    });
  } catch (error) {
    console.error('Failed to capture job_payment_accepted', error);
  }
};

export const capturePaymentFailed = (
  context: PaidStartContext,
  subsidy: JobSubsidy,
  error: unknown,
  failureStage: 'invalid_reply' | 'node_call'
) => {
  try {
    // ocean.js node errors, HTTP and P2P alike, carry the node's status as `httpStatus`.
    const httpStatus = (error as { httpStatus?: unknown } | null)?.httpStatus;
    captureError('job_payment_failed', error, {
      ...buildPaymentProps(context, subsidy),
      failureStage,
      httpStatus: typeof httpStatus === 'number' ? httpStatus : getHttpStatus(error),
    });
  } catch (captureFailure) {
    console.error('Failed to capture job_payment_failed', captureFailure);
  }
};
