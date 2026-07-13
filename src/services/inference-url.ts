import { GpuSelection } from '@/components/hooks/use-inference-allocation';
import { ModelParameters } from '@/types/huggingface';

/**
 * Query-param (de)serializers for the inference wizard. Selection is persisted as individual,
 * mostly-readable query params — carried forward with `...router.query` on every navigation and
 * read back on refresh — mirroring the run-job flow (peerId/env/token/…). Only the nested per-model
 * launch parameters, which have no readable flat form, are packed into a single base64url blob.
 *
 * Query keys:
 * - `models`   comma-separated model ids (see encodeModelIds/decodeModelIds)
 * - `peerId`   node peer id hosting the selected environment
 * - `env`      selected compute environment id
 * - `gpus`     per-type GPU unit counts, `key:count` pairs, comma-separated (keys URL-encoded)
 * - `token`    selected fee token address
 * - `duration` job duration in seconds
 * - `params`   base64url JSON of per-model launch parameters (custom-model config step)
 */

/** Serialize per-type GPU unit counts into a `key:count,key:count` string. */
export function encodeGpuSelection(selection: GpuSelection | undefined): string | undefined {
  if (!selection) {
    return undefined;
  }
  const parts = Object.entries(selection).map(([key, count]) => `${encodeURIComponent(key)}:${count}`);
  return parts.length > 0 ? parts.join(',') : undefined;
}

/** Parse the `gpus` param back into per-type unit counts. Malformed pairs are skipped. */
export function decodeGpuSelection(raw: string | string[] | undefined): GpuSelection | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  const result: GpuSelection = {};
  value.split(',').forEach((pair) => {
    const idx = pair.lastIndexOf(':');
    if (idx <= 0) {
      return;
    }
    const key = decodeURIComponent(pair.slice(0, idx));
    const count = Number(pair.slice(idx + 1));
    if (key && Number.isFinite(count)) {
      result[key] = count;
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}

function base64UrlEncode(input: string): string {
  const base64 = typeof window === 'undefined' ? Buffer.from(input, 'utf-8').toString('base64') : window.btoa(input);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return typeof window === 'undefined' ? Buffer.from(padded, 'base64').toString('utf-8') : window.atob(padded);
}

/** Serialize per-model launch parameters into a single URL-safe blob (or undefined when empty). */
export function encodeModelParams(byModel: Record<string, ModelParameters> | undefined): string | undefined {
  if (!byModel || Object.keys(byModel).length === 0) {
    return undefined;
  }
  return base64UrlEncode(JSON.stringify(byModel));
}

/** Parse the `params` blob back into per-model launch parameters; empty object when absent/malformed. */
export function decodeModelParams(raw: string | string[] | undefined): Record<string, ModelParameters> {
  if (!raw) {
    return {};
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  try {
    const parsed = JSON.parse(base64UrlDecode(value)) as Record<string, ModelParameters>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
