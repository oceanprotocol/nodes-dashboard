import { CHAIN_ID } from '@/constants/chains';
import { DEFAULT_NODE_URI } from '@/constants/default-node';
import { NodeUri } from '@/contexts/P2PContext';
import { mergeMockBundles, MOCK_BUNDLES_ENABLED } from '@/mock/bundles';
import { AppBundle, AppTemplate, isBundle, isService } from '@/types/templates';
import { ServiceTemplatePublic } from '@oceanprotocol/lib';

/**
 * The node's public template getter (ProviderInstance.getServiceTemplates), as exposed by useP2P().
 * Kept as a param so callers pass the ready-gated hook version — this module stays hook-free.
 */
export type GetServiceTemplatesFn = (
  nodeUri: NodeUri,
  chainId?: number,
  signal?: AbortSignal
) => Promise<ServiceTemplatePublic[]>;

/**
 * Fetch the app templates advertised by the default node (getServiceTemplates), scoped to the active
 * chain. The payload is used as-is — `AppTemplate` only adds fields the node already sends through its
 * sanitizer's spread. Array-guarded so a malformed response can't throw. Pass the caller's
 * `useP2P().getServiceTemplates` (it throws until the P2P node is ready, so gate on `isReady`).
 *
 * This is the single choke point every caller goes through (the catalogue hook, the URL hydration in
 * inference-context, the running-services table), which is why the bundle mock is merged here: the
 * whole flow — browse, launch, manage — sees the same catalogue. The mock is on unless
 * `NEXT_PUBLIC_MOCK_BUNDLES=0`, and the merge is a no-op when it's off. See src/mock/bundles.ts.
 */
export async function fetchTemplates(
  getServiceTemplates: GetServiceTemplatesFn,
  signal?: AbortSignal
): Promise<AppTemplate[]> {
  try {
    const result = await getServiceTemplates(DEFAULT_NODE_URI, CHAIN_ID, signal);
    return mergeMockBundles(Array.isArray(result) ? result : []);
  } catch (err) {
    // With the mock on, an unreachable node still yields a browsable catalogue — that's the point of
    // the flag, and it makes the flow testable with no node at all. Without it, the error is the
    // caller's to render. An aborted fetch always rethrows: it means the caller went away.
    if (!MOCK_BUNDLES_ENABLED || signal?.aborted) {
      throw err;
    }
    console.warn('Node templates unavailable — falling back to the bundle mock:', err);
    return mergeMockBundles([]);
  }
}

/** Look up one template by id (the `[templateId]` route param / URL hydration). */
export function findTemplateById(templates: AppTemplate[], id: string): AppTemplate | null {
  return templates.find((t) => t.id === id) ?? null;
}

/**
 * Match a running service back to the template it was launched from, by container image. Tag is
 * ignored on purpose: serviceRestart can't change the image anyway, so image alone identifies the app.
 *
 * Prefer findTemplateForService — a bundle shares its parent service's image, so image alone can't
 * tell them apart.
 */
export function findTemplateByImage(templates: AppTemplate[], image: string | undefined): AppTemplate | null {
  if (!image) {
    return null;
  }
  return templates.find((t) => t.image === image) ?? null;
}

function sameCommand(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length && left.every((value, i) => value === right[i]);
}

/**
 * Match a running service back to the template it was launched from. Every bundle of a service runs
 * the SAME image as that service (a bundle differs only in the `command` that pre-downloads its
 * models), so image alone resolves all of them to whichever template happens to come first — which is
 * how a running bundle used to show its parent's name and load its parent's config on Edit.
 *
 * So: match image AND command exactly first, and only fall back to image alone. The fallback covers
 * two cases, both of which degrade to "the right app, maybe not the right variant" rather than to
 * nothing: the listing endpoint (SERVICE_LIST) strips `dockerCmd`, and an operator may have edited the
 * template's JSON since this service was launched.
 */
export function findTemplateForService(
  templates: AppTemplate[],
  service: { image?: string; dockerCmd?: string[] }
): AppTemplate | null {
  if (!service.image) {
    return null;
  }
  const sameImage = templates.filter((t) => t.image === service.image);
  if (sameImage.length === 0) {
    return null;
  }
  // Only trust a command match when the running service actually reported one.
  if (service.dockerCmd && service.dockerCmd.length > 0) {
    const exact = sameImage.find((t) => sameCommand(t.command, service.dockerCmd));
    if (exact) {
      return exact;
    }
  }
  return sameImage[0];
}

/** The bare services of a catalogue — bundles are shown on their own page, never twice. */
export function selectServices(templates: AppTemplate[]): AppTemplate[] {
  return templates.filter(isService);
}

/** The bundles of a catalogue. */
export function selectBundles(templates: AppTemplate[]): AppBundle[] {
  return templates.filter(isBundle);
}

/** One section of the bundles page: a parent service and the bundles that target it. */
export type BundleGroup = {
  /** The parent service's template id — the grouping key. */
  serviceId: string;
  /** The parent's display name when it is published by this node, else its bare id. */
  serviceName: string;
  /** The parent template, when this node publishes it (it may publish only the bundle). */
  service: AppTemplate | null;
  bundles: AppBundle[];
};

/**
 * Group bundles under their parent service, ordered by the parent's position in the catalogue so the
 * sections are stable across reloads. A bundle whose parent this node doesn't publish still gets its
 * own section, headed by the raw service id — the node's schema deliberately allows that.
 */
export function groupBundlesByService(templates: AppTemplate[]): BundleGroup[] {
  const groups = new Map<string, BundleGroup>();
  for (const bundle of selectBundles(templates)) {
    let group = groups.get(bundle.service);
    if (!group) {
      const service = templates.find((t) => t.id === bundle.service && isService(t)) ?? null;
      group = {
        serviceId: bundle.service,
        serviceName: service?.name ?? bundle.service,
        service,
        bundles: [],
      };
      groups.set(bundle.service, group);
    }
    group.bundles.push(bundle);
  }
  return [...groups.values()];
}
