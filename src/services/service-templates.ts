import { CHAIN_ID } from '@/constants/chains';
import { DEFAULT_NODE_URI } from '@/constants/default-node';
import { NodeUri } from '@/contexts/P2PContext';
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
 * This is the single choke point every caller goes through — the catalogue hook, the URL hydration in
 * inference-context, the running-services table — so the whole flow (browse, launch, manage) sees the
 * same catalogue. An unreachable node is the caller's error to render.
 */
export async function fetchTemplates(
  getServiceTemplates: GetServiceTemplatesFn,
  signal?: AbortSignal
): Promise<AppTemplate[]> {
  const result = await getServiceTemplates(DEFAULT_NODE_URI, CHAIN_ID, signal);
  return Array.isArray(result) ? result : [];
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

export type TemplateMatch = {
  template: AppTemplate | null;
  /**
   * How it was matched: 'command' = image AND exact command, the only authoritative one. 'image' =
   * image alone, a guess whenever the image has more than one template (see `ambiguous`).
   */
  source: 'command' | 'image' | null;
  /** Image-only match against an image several templates share — the variant is a coin flip. */
  ambiguous: boolean;
};

/**
 * Match a running service back to the template it was launched from. Every bundle of a service runs
 * the SAME image as that service (a bundle differs only in the `command` that pre-downloads its
 * models), so image alone resolves all of them to whichever template happens to come first — which is
 * how a running bundle used to show its parent's name and load its parent's config on Edit.
 *
 * So: match image AND command exactly first, and only fall back to image alone. The fallback covers
 * two cases: the listing endpoint (SERVICE_LIST) strips `dockerCmd`, and an operator may have edited
 * the template's JSON since this service was launched. It's reported as `source: 'image'` (and
 * `ambiguous` when the image has variants) rather than passed off as a real match, so a caller that
 * would act on it — seeding an Edit, sending a launch — can decline instead of guessing wrong. Naming
 * is safe on an ambiguous match: it resolves to the bare service, whose name covers every variant.
 */
export function matchTemplateForService(
  templates: AppTemplate[],
  service: { image?: string; dockerCmd?: string[] }
): TemplateMatch {
  const unmatched: TemplateMatch = { template: null, source: null, ambiguous: false };
  if (!service.image) {
    return unmatched;
  }
  const sameImage = templates.filter((t) => t.image === service.image);
  if (sameImage.length === 0) {
    return unmatched;
  }
  // Only trust a command match when the running service actually reported its command — but an empty
  // array IS a report ("no CMD override", which the node stores as an explicit value), and it's how a
  // bare service is told apart from the bundles sharing its image. Absent (undefined) is the
  // unknown case: a stripped listing, where anything below is a guess.
  if (service.dockerCmd) {
    const exact = sameImage.find((t) => sameCommand(t.command, service.dockerCmd));
    if (exact) {
      return { template: exact, source: 'command', ambiguous: false };
    }
  }
  // Ambiguous fallback resolves to the bare SERVICE, not whichever variant happens to come first: the
  // service is the one entry every candidate agrees on (a bundle is that same app with models
  // pre-downloaded), so its name is right for the whole set even when the variant isn't known.
  return { template: sameImage.find(isService) ?? sameImage[0], source: 'image', ambiguous: sameImage.length > 1 };
}

/** The matched template regardless of how confident the match is — see matchTemplateForService. */
export function findTemplateForService(
  templates: AppTemplate[],
  service: { image?: string; dockerCmd?: string[] }
): AppTemplate | null {
  return matchTemplateForService(templates, service).template;
}

/** The bare services of a catalogue — bundles are shown on their own page, never twice. */
export function selectServices(templates: AppTemplate[]): AppTemplate[] {
  return templates.filter(isService);
}

/** The bundles of a catalogue. */
export function selectBundles(templates: AppTemplate[]): AppBundle[] {
  return templates.filter(isBundle);
}

