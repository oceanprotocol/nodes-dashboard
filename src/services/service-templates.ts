import { CHAIN_ID } from '@/constants/chains';
import { DEFAULT_NODE_HTTP_URL, DEFAULT_NODE_URI } from '@/constants/default-node';
import { NodeUri } from '@/contexts/P2PContext';
import { withTimeout } from '@/lib/with-timeout';
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
 * How long a fetched catalogue is reused before the node is asked again. The catalogue only changes
 * when an operator edits the node's template directory, so a short window costs nothing in freshness
 * and takes a whole libp2p round trip off every consumer that mounts within it.
 */
const CATALOGUE_TTL_MS = 60_000;

/**
 * Cap on one catalogue round trip. Shorter than the status poll's 30s: this one gates the manage
 * page's Edit / Prolong buttons, so a hung dial has to fail fast enough for the retries above it to
 * finish inside a user's patience.
 */
const CATALOGUE_TIMEOUT_MS = 15_000;

/**
 * Cap on one NON-final transport attempt. Well under CATALOGUE_TIMEOUT_MS on purpose: the point of
 * trying HTTP first is to fail fast onto the next rung, so a hung TCP connect must not eat the budget
 * the P2P fallback needs. Measured against the default node, HTTP answers in ~1.4-2.1s.
 */
const TRANSPORT_TIMEOUT_MS = 6000;

/**
 * Run one non-final transport, capped and non-throwing: a miss is `null` so the ladder can fall
 * through without a try/catch per rung. Only the LAST rung is allowed to throw (that failure is the
 * fetch's failure, which callers need in order to tell "catalogue unreachable" from "matched nothing").
 *
 * Takes NO caller signal, only its own timeout — same rule as the shared request it runs inside (see
 * inFlightCatalogue). Wiring a caller's signal in here let the first consumer to unmount abort the
 * fetch every other consumer was awaiting, which under React StrictMode's double-mount is the very
 * first thing that happens: the catalogue died with `signal is aborted without reason` on every load.
 * A caller that goes away is dropped by the race in fetchTemplates instead.
 */
async function tryCatalogueTransport(
  name: string,
  attempt: (signal: AbortSignal) => Promise<ServiceTemplatePublic[]>
): Promise<AppTemplate[] | null> {
  try {
    const result = await withTimeout(attempt, TRANSPORT_TIMEOUT_MS, `Service templates (${name})`);
    const templates = Array.isArray(result) ? (result as AppTemplate[]) : [];
    // An empty catalogue is a legitimate answer (a node advertising nothing) but indistinguishable
    // from a transport that answered with junk, and falling through costs one round trip and can only
    // improve on it. Treated as a miss deliberately.
    return templates.length > 0 ? templates : null;
  } catch (error) {
    console.warn(`Template catalogue via ${name} failed, trying next transport:`, error);
    return null;
  }
}

/** Resolved catalogue plus when it landed — `null` until the first successful fetch. */
let cachedCatalogue: { templates: AppTemplate[]; at: number } | null = null;
/**
 * The request currently in flight, shared by every caller that asks while it runs. Deliberately
 * started WITHOUT any caller's `signal`: the manage page, the services table and the URL hydration
 * all fetch the same catalogue at the same moment, and letting the first one to unmount abort the
 * shared request would strand the others.
 */
let inFlightCatalogue: Promise<AppTemplate[]> | null = null;

/**
 * Fetch the app templates advertised by the default node, scoped to the active chain. The payload is
 * used as-is — `AppTemplate` only adds fields the node already sends through its sanitizer's spread.
 * Array-guarded so a malformed response can't throw.
 *
 * Tried over two transports in order (HTTP, then P2P — see the ladder below), both addressing the one
 * default node, so its HTTP face being down no longer takes the catalogue with it. Pass the caller's
 * `useP2P().getServiceTemplates`; it no longer throws before libp2p is ready unless the uri is a
 * multiaddr, so the HTTP rung works during startup and callers needn't gate on `isReady`.
 *
 * DELIBERATELY NOT PER-NODE, despite templates being a per-node concept. Only the default node
 * currently implements the templates handler at all: every other node on the network answers
 * SERVICE_GET_TEMPLATES with `501 No handler found` (they run older ocean-node builds), so resolving a
 * catalogue against the node a service actually runs on would fail for essentially all of them and
 * take the manage page's Edit / Prolong down with it. Revisit once the handler is widely deployed —
 * until then the honest description is "the catalogue", singular.
 *
 * This is the single choke point every caller goes through — the catalogue hook, the URL hydration in
 * inference-context, the running-services table — so the whole flow (browse, launch, manage) sees the
 * same catalogue. An unreachable node is the caller's error to render.
 *
 * Cached for CATALOGUE_TTL_MS and de-duplicated while in flight. Four independent consumers used to
 * fetch the whole catalogue — every template's full workflow graph, re-read from disk node-side — on
 * every mount; on the manage page that round trip is what the template match races, so collapsing it
 * to one request is a correctness win as much as a latency one. A failed fetch caches nothing, so the
 * next caller retries.
 *
 * `signal` aborts THIS caller's wait, not the shared request (see inFlightCatalogue).
 */
export async function fetchTemplates(
  getServiceTemplates: GetServiceTemplatesFn,
  signal?: AbortSignal
): Promise<AppTemplate[]> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (cachedCatalogue && Date.now() - cachedCatalogue.at < CATALOGUE_TTL_MS) {
    return cachedCatalogue.templates;
  }
  if (!inFlightCatalogue) {
    const request = (async () => {
      // Two transports, cheapest first — both of them ocean.js's own `getServiceTemplates`, which
      // dispatches on the SHAPE of the uri it is handed: `isP2pUri()` sends a peer id / multiaddr to
      // P2pProvider and anything else to HttpProvider (see BaseProvider.getImpl). So the rungs differ
      // only in what we pass, not in any transport code of ours.
      //
      //   1. HTTP — DEFAULT_NODE_HTTP_URL, a plain url ⇒ HttpProvider ⇒ GET /api/services/serviceTemplates.
      //             No libp2p, no P2P readiness, and measurably the faster of the two.
      //   2. P2P  — DEFAULT_NODE_URI, a multiaddr ⇒ P2pProvider ⇒ SERVICE_GET_TEMPLATES over libp2p.
      //             Slower and needs a ready browser node, but it survives the HTTP face being down.
      //
      // Both address the SAME node (see DEFAULT_NODE_HTTP_URL) — the rungs are two ways to reach one
      // catalogue, not two catalogues. Passing the multiaddr was the ONLY thing this used to do, which
      // forced every consumer down the P2P path even though that node answers over HTTP in about a
      // third of the time.
      //
      // Worth walking a ladder here specifically because the catalogue is public and unsigned: unlike
      // every other node call in this flow there is no auth token or per-address nonce to burn, so a
      // failed rung costs only its own round trip.
      const httpTemplates = await tryCatalogueTransport('http', (attemptSignal) =>
        getServiceTemplates(DEFAULT_NODE_HTTP_URL, CHAIN_ID, attemptSignal)
      );
      // A libp2p round trip has no timeout of its own: an unreachable node/relay leaves the promise
      // pending forever. That used to cost nothing, but the manage page now holds Edit/Prolong until
      // the match settles, so a hung dial would disable them indefinitely. Cap it and let the caller's
      // retry decide what to do. `withTimeout` aborts the dial too, rather than leaving it running.
      //
      // Not wrapped in tryCatalogueTransport: this is the last rung, so a failure here IS the fetch's
      // failure and must reach the caller (which retries, and distinguishes "unreachable" from "no
      // match" — see useJobTemplate). It also gets the full budget rather than the per-rung cap,
      // there being nothing after it to leave time for.
      const templates =
        httpTemplates ??
        (await withTimeout(
          async (timeoutSignal) => {
            const result = await getServiceTemplates(DEFAULT_NODE_URI, CHAIN_ID, timeoutSignal);
            return Array.isArray(result) ? (result as AppTemplate[]) : [];
          },
          CATALOGUE_TIMEOUT_MS,
          'Service templates'
        ));
      cachedCatalogue = { templates, at: Date.now() };
      return templates;
    })().finally(() => {
      inFlightCatalogue = null;
    });
    // Every caller may have gone away (each holds only its own aborted race, below) by the time this
    // rejects, and a rejection nobody is attached to surfaces as an unhandled promise rejection.
    request.catch(() => {});
    inFlightCatalogue = request;
  }
  const request = inFlightCatalogue;
  if (!signal) {
    return request;
  }
  // Honour the caller's signal without touching the shared request: whichever settles first wins.
  // The listener is removed once the request settles, so a caller reusing one long-lived signal
  // across calls doesn't pile listeners onto it.
  return new Promise<AppTemplate[]>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
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
   * How it was matched: 'command' = image AND a command only ONE template has, the only
   * authoritative one. 'image' = a guess — image alone, or a command several templates share (see
   * `ambiguous`).
   */
  source: 'command' | 'image' | null;
  /** Match against an image (or image + command) several templates share — the variant is a coin flip. */
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
    // A command match only names the variant when it's UNIQUE. Bundles sharing an image can also
    // share a command — the ComfyUI UGC bundles all inline the same `commandFile` bootstrap and
    // differ only in their workflows — and picking the first of those is the same coin flip as an
    // image-only match. Reporting it as 'command' would let a caller that outranks a known template
    // on an exact match (the manage page) relabel a running service as its sibling.
    const exact = sameImage.filter((t) => sameCommand(t.command, service.dockerCmd));
    if (exact.length === 1) {
      return { template: exact[0], source: 'command', ambiguous: false };
    }
    if (exact.length > 1) {
      return { template: exact.find(isService) ?? exact[0], source: 'image', ambiguous: true };
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
