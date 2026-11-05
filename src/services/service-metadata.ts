import { InferenceBranch, resolveInferenceBranch } from '@/lib/inference-analytics';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate } from '@/types/templates';
import type { ComputeJobMetadata } from '@oceanprotocol/lib';

/**
 * Owner-supplied labels the dashboard stamps on every service it launches, so a running service can
 * say what it IS instead of being reverse-engineered from its container.
 *
 * The node treats `metadata` as an opaque flat bag of scalars (≤1 KB JSON, enforced node-side — see
 * ocean-node `isJobMetadataSizeValid`), sends it UNENCRYPTED, and returns it on both the owner-scoped
 * SERVICE_GET_STATUS **and** the node-wide SERVICE_LIST — the listing that strips `dockerCmd` and so
 * used to make every catalogue match a guess. Two keys is ~55 bytes, nowhere near the cap.
 *
 * Only OUR keys are read, and defensively (see readServiceMetadata): the bag is owner-supplied, so a
 * service launched by ocean-cli or an older dashboard build carries other keys, or none.
 */
export const APP_TYPE_KEY = 'appType';
export const APP_ID_KEY = 'appId';

/**
 * Which of the four inference flows launched a service — the wire vocabulary, and the thing that says
 * which NAMESPACE `appId` belongs to: a Hugging Face model id for the two model types, a catalogue
 * template id for the two template types.
 *
 * Mirrors {@link InferenceBranch} one-for-one (see APP_TYPE_BY_BRANCH); the two vocabularies differ
 * only in wording — PostHog's funnels were named first, and renaming them would break the funnels.
 */
export type ServiceAppType = 'default-model' | 'custom-model' | 'service' | 'template';

const APP_TYPES: readonly ServiceAppType[] = ['default-model', 'custom-model', 'service', 'template'];

/** Exhaustive by construction, so a new branch can't silently ship without a wire name. */
const APP_TYPE_BY_BRANCH: Record<InferenceBranch, ServiceAppType> = {
  custom: 'custom-model',
  quickstart: 'default-model',
  service: 'service',
  template: 'template',
};

const BRANCH_BY_APP_TYPE: Record<ServiceAppType, InferenceBranch> = {
  'custom-model': 'custom',
  'default-model': 'quickstart',
  service: 'service',
  template: 'template',
};

/** `appId` is a catalogue template id — resolve it with findTemplateById. */
export function isTemplateAppType(appType: ServiceAppType): boolean {
  return appType === 'service' || appType === 'template';
}

/** `appId` is a Hugging Face model id, and the service runs no catalogue template at all. */
export function isModelAppType(appType: ServiceAppType): boolean {
  return appType === 'default-model' || appType === 'custom-model';
}

/**
 * The wire type for a launch. Derived from {@link resolveInferenceBranch} rather than re-deriving off
 * `flowType`/`isBundle`, so the label stamped on a service and the branch reported to PostHog cannot
 * disagree about what the user was doing.
 */
export function resolveServiceAppType(flowType: InferenceFlowType, template?: AppTemplate | null): ServiceAppType {
  return APP_TYPE_BY_BRANCH[resolveInferenceBranch(flowType, template)];
}

/**
 * The branch a RUNNING service belongs to, read back off its own labels. Lets the manage page report
 * the real branch instead of guessing: read off the container alone, a quickstart launch and a custom
 * one are indistinguishable (both are plain model services), and a bundle matched only by image
 * resolves to the bare service its family shares.
 */
export function branchForAppType(appType: ServiceAppType): InferenceBranch {
  return BRANCH_BY_APP_TYPE[appType];
}

/**
 * Narrow an untrusted string (a query param, a metadata value) to a known app type. `null` for
 * anything else, so a stale or hand-edited value degrades to "unknown" rather than being trusted.
 */
export function parseServiceAppType(value: unknown): ServiceAppType | null {
  return typeof value === 'string' && APP_TYPES.includes(value as ServiceAppType) ? (value as ServiceAppType) : null;
}

/** What a running service declares itself to be. */
export type ServiceAppIdentity = {
  appType: ServiceAppType;
  /** HF model id when {@link isModelAppType}, catalogue template id when {@link isTemplateAppType}. */
  appId: string;
};

/**
 * The metadata bag to send with serviceStart / serviceRestart. `undefined` when there is no id to
 * stamp (a flow that somehow reached a launch with no model/template selected) — a half-filled bag
 * would be worse than none, since a reader that trusts `appType` would then look up an empty id.
 *
 * Note for serviceRestart: an omitted `metadata` REUSES the stored bag, an explicit one REPLACES it.
 * Edit can swap the model or even the app in place, so every restart that rebuilds the container must
 * re-stamp — otherwise the labels describe what the service used to be.
 */
export function buildServiceMetadata(identity: {
  appType: ServiceAppType;
  appId?: string | null;
}): ComputeJobMetadata | undefined {
  const appId = identity.appId?.trim();
  if (!appId) {
    return undefined;
  }
  return { [APP_TYPE_KEY]: identity.appType, [APP_ID_KEY]: appId };
}

/**
 * Read our labels off a service record — the node's job (SERVICE_GET_STATUS), its listing
 * (SERVICE_LIST) or the backend's session record, all of which carry the bag verbatim.
 *
 * `null` means "this service does not tell us", which covers three real cases and must not be
 * confused with any of them individually: launched before these labels existed, launched by another
 * client, or reached us through a hop that drops the bag. Callers fall back to matching by
 * image/dockerCmd in that case.
 *
 * Every field is validated because the bag is owner-supplied and node-opaque: the node checks only
 * that the values are scalars within 1 KB, never what they mean.
 */
export function readServiceMetadata(
  source: { metadata?: ComputeJobMetadata } | null | undefined
): ServiceAppIdentity | null {
  const bag = source?.metadata;
  if (!bag) {
    return null;
  }
  const appType = parseServiceAppType(bag[APP_TYPE_KEY]);
  const rawAppId = bag[APP_ID_KEY];
  // Trimmed to mirror buildServiceMetadata, which writes a trimmed id: a whitespace-only value names
  // nothing, so it has to read as "does not tell us" and fall back to image/dockerCmd matching.
  const appId = typeof rawAppId === 'string' ? rawAppId.trim() : '';
  if (!appType || appId.length === 0) {
    return null;
  }
  return { appType, appId };
}
