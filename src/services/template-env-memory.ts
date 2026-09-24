import { AppTemplate } from '@/types/templates';

/**
 * The non-secret env values a template service was launched with, remembered in this browser so Edit
 * can prefill them. The node never echoes a service's env (userData is encrypted in transit and not
 * returned by any status call), so without this every relaunch starts from empty fields.
 *
 * Only vars the template marks `sensitive: false` are kept: a secret, or a var whose sensitivity isn't
 * declared, never reaches storage. Keyed by service id, which is unique per launch and kept across
 * relaunches.
 */
const STORAGE_PREFIX = 'inference-template-env';

const storageKey = (serviceId: string) => `${STORAGE_PREFIX}-${serviceId}`;

export function rememberTemplateEnv({
  serviceId,
  template,
  values,
}: {
  serviceId: string;
  template: AppTemplate;
  values: Record<string, string>;
}): void {
  const kept: Record<string, string> = {};
  for (const spec of template.userConfigurableEnvVars ?? []) {
    const value = values[spec.key];
    if (spec.sensitive === false && value) {
      kept[spec.key] = value;
    }
  }
  // localStorage can throw (Safari private mode, storage full); prefilling is a convenience only.
  try {
    if (Object.keys(kept).length > 0) {
      localStorage.setItem(storageKey(serviceId), JSON.stringify(kept));
    } else {
      localStorage.removeItem(storageKey(serviceId));
    }
  } catch (error) {
    console.error('Failed to remember template env values:', error);
  }
}

/** The remembered non-secret values for a service, filtered to the vars its template still declares. */
export function recallTemplateEnv({
  serviceId,
  template,
}: {
  serviceId: string;
  template: AppTemplate;
}): Record<string, string> {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(serviceId)) ?? '{}') as Record<string, unknown>;
    const recalled: Record<string, string> = {};
    for (const spec of template.userConfigurableEnvVars ?? []) {
      const value = stored[spec.key];
      if (spec.sensitive === false && typeof value === 'string' && value) {
        recalled[spec.key] = value;
      }
    }
    return recalled;
  } catch {
    return {};
  }
}
