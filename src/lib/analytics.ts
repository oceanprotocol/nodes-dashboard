import posthog from 'posthog-js';

/**
 * Coarse classification of a client-side error. Kept in sync with the
 * vscode-extension `classifyComputeError` buckets so `error_type` is comparable
 * across both repos when analysing the end-to-end start-compute funnel.
 */
export type ErrorType =
  | 'validation'
  | 'network'
  | 'provider'
  | 'auth'
  | 'insufficient_funds'
  | 'timeout'
  | 'oom'
  | 'user_rejected'
  | 'unknown';

export const classifyError = (error: unknown): ErrorType => {
  const err = error as (Error & { code?: string | number }) | undefined;
  const message = (err?.message ?? String(error ?? '')).toLowerCase();
  const name = (err?.name ?? '').toLowerCase();
  const code = err?.code;

  if (!message && !name) return 'unknown';

  // Wallet / user cancellation — very common in payment & claim flows.
  if (
    code === 4001 ||
    code === 'ACTION_REJECTED' ||
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('rejected the request') ||
    message.includes('request rejected')
  )
    return 'user_rejected';
  if (
    message.includes('insufficient') ||
    message.includes('not enough') ||
    message.includes('exceeds balance')
  )
    return 'insufficient_funds';
  if (
    message.includes('unauthorized') ||
    message.includes('signature') ||
    message.includes('nonce') ||
    message.includes('auth token') ||
    message.includes('authtoken') ||
    message.includes('403') ||
    message.includes('401')
  )
    return 'auth';
  if (
    message.includes('missing required') ||
    message.includes('invalid') ||
    message.includes('no escrow found') ||
    message.includes('required')
  )
    return 'validation';
  if (message.includes('timeout') || message.includes('timed out') || name.includes('timeout'))
    return 'timeout';
  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    name.includes('networkerror')
  )
    return 'network';
  if (
    message.includes('provider') ||
    message.includes('node') ||
    message.includes('status code') ||
    message.includes('http')
  )
    return 'provider';
  return 'unknown';
};

/**
 * Captures a structured failure event to PostHog. Additive helper used by the
 * `*_failed` events across the run-job / claim / node-config flows so the shape
 * (source / reason / error_type / error_name) stays consistent.
 */
export const captureError = (
  event: string,
  error: unknown,
  extraProps: Record<string, unknown> = {}
): void => {
  const err = error as Error | undefined;
  posthog.capture(event, {
    source: 'dashboard',
    reason: err?.message ?? String(error),
    error_name: err?.name,
    error_type: classifyError(error),
    ...extraProps,
  });
};
