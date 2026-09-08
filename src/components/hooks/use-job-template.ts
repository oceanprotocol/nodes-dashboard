import { useP2P } from '@/contexts/P2PContext';
import { isModelAppType, readServiceMetadata } from '@/services/service-metadata';
import { fetchTemplates, matchTemplateForService } from '@/services/service-templates';
import { AppTemplate } from '@/types/templates';
import type { ComputeJobMetadata } from '@oceanprotocol/lib';
import { useEffect, useRef, useState } from 'react';

/** The facts a running service is matched back to the catalogue by — see matchTemplateForService. */
type JobContainer = {
  /** The service's own labels, when it carries them. Answers outright; the rest is fallback evidence. */
  metadata?: ComputeJobMetadata;
  image?: string;
  dockerCmd?: string[];
};

type JobTemplateState = {
  /** The matched catalogue entry, or null while unmatched / unmatchable. */
  template: AppTemplate | null;
  /** A match is in flight — callers wait it out rather than claiming "unknown" too early. */
  matching: boolean;
  /**
   * The match came from image AND command, so it names the exact variant the container runs. False for
   * an image-only guess — a caller weighing this against a template the URL named should only outrank
   * the URL when this is true.
   */
  exact: boolean;
  /**
   * The match landed on one of SEVERAL candidates that the running container cannot be told apart from
   * — `template` is a coin flip among them, right for naming (they share an app) but wrong to act on.
   *
   * Distinct from `!exact`: an image-only match of a lone candidate is inexact yet unambiguous, and a
   * caller may still act on it. This flag means the record genuinely does not identify the variant, so
   * Edit / Prolong must decline rather than route to whichever sibling sorted first (see
   * matchTemplateForService — bundles sharing an image AND a command are indistinguishable on the wire).
   */
  ambiguous: boolean;
  /**
   * The service DECLARED what it is — its own `metadata` labels named a catalogue entry, or named a
   * model flow (in which case `template` is null because it genuinely runs no template). Outranks
   * every other claim about this service, the URL's included: nothing else is the container speaking
   * for itself, and a null `template` here is an answer rather than an absence of one.
   */
  declared: boolean;
  /**
   * The match ran to completion (successfully or not) for the container currently passed in, so
   * `template` is this service's real answer rather than "not yet". `false` while there is nothing to
   * match (no job) — callers that must not act on an unknown template gate on `settled`, not on
   * `!matching`, which is also false before the first attempt starts.
   */
  settled: boolean;
  /**
   * The catalogue could not be reached after MAX_ATTEMPTS, so this service's identity is unknown —
   * distinct from a completed match that found nothing. `settled` stays false, so a caller that
   * branches on the template holds the action rather than taking the no-template branch by default.
   */
  failed: boolean;
};

/** How many times a failed catalogue fetch is retried before the match gives up for this container. */
const MAX_ATTEMPTS = 3;
/** Backoff before a retry — long enough not to hammer an unreachable node, short enough to beat a click. */
const RETRY_DELAY_MS = 1500;

/**
 * Match a running service back to the template it was launched from, using the node's own job record.
 *
 * Needed because the URL doesn't always say: the manage page only gets `template=` when the BACKEND
 * session record held enough to match (its listing strips `dockerCmd`, and a record with no `image`
 * matches nothing), and an in-flow redirect can drop the query altogether. Without a match the page
 * falls through to the Model card and claims "Unknown model" for an app that serves no model at all.
 *
 * A dashboard-launched service carries its own `metadata` labels (appType + appId), which answer
 * outright — including "this is a model service", the one conclusion image matching can never reach.
 * Anything without them falls back to image + dockerCmd, which is what distinguishes a bundle from
 * its parent service (they share the image and differ only in `command`).
 *
 * Always matched, even when the URL already names a template or claims a plain model service: the
 * link is only ever as good as whatever generated it, and `declared` / `exact` say whether this match
 * outranks it.
 *
 * @param job    container facts from the polled job record — a fresh object every tick, so the lookup
 *               is keyed on the facts themselves and not repeated while they're unchanged.
 */
const useJobTemplate = (job: JobContainer | null): JobTemplateState => {
  const { isReady, getServiceTemplates } = useP2P();
  const [state, setState] = useState<{
    key: string | null;
    template: AppTemplate | null;
    exact: boolean;
    ambiguous: boolean;
    declared: boolean;
    /** The catalogue itself was unreachable, so "no template" is an absence of an answer, not one. */
    failed: boolean;
  }>({
    key: null,
    template: null,
    exact: false,
    ambiguous: false,
    declared: false,
    failed: false,
  });
  const [matching, setMatching] = useState(false);
  // Bumped to re-run the effect after a transient catalogue failure. Reset whenever the key changes.
  const [attempt, setAttempt] = useState(0);

  /**
   * The container facts, NUL-joined (a delimiter no image ref or argv entry can itself contain).
   * Computed during render and used as the effect's dependency in place of `job` itself: the status
   * poll hands us a brand-new object — and a brand-new `dockerCmd` array — every tick, so depending
   * on the object's identity re-ran this effect every POLL_INTERVAL_MS, and each re-run's cleanup
   * cancelled the catalogue fetch still in flight from the previous one. A fetch slower than one poll
   * interval could therefore never land, leaving `template` null for the life of the page.
   */
  const identity = readServiceMetadata(job);
  const key = job
    ? [identity?.appType ?? '', identity?.appId ?? '', job.image ?? '', ...(job.dockerCmd ?? [])].join('\u0000')
    : null;
  // Read the facts inside the effect without making the effect depend on their identity: `key`
  // already changes whenever they do.
  const jobRef = useRef(job);
  jobRef.current = job;

  // A different container is a different question — drop the previous service's answer rather than
  // showing it against this one while the new match runs (the hook survives a serviceId change).
  // Only a different REAL container counts: the status poll resolves to `null` on a tick whose listing
  // comes back empty or mismatched, and treating that gap as a new identity would throw away a match
  // already made and refetch the catalogue when the same job reappears a tick later.
  const matchedKeyRef = useRef<string | null>(null);
  if (key !== null && matchedKeyRef.current !== key) {
    matchedKeyRef.current = key;
    // Every new container starts its retry budget fresh, whether or not the previous one ever
    // resolved. Resetting only alongside the state reset below left the count behind whenever the
    // previous key was still mid-retry (it never wrote `state.key`, so that stayed null): the new
    // service inherited the old one's attempts and got fewer retries — or, at MAX_ATTEMPTS - 1, was
    // declared `failed` on its first failure.
    setAttempt(0);
    if (state.key !== null && state.key !== key) {
      setState({ key: null, template: null, exact: false, ambiguous: false, declared: false, failed: false });
    }
  }

  /**
   * The service declared itself a MODEL service, so it runs no catalogue template — there is nothing
   * to look up, and nothing to gate on libp2p being up. Answered synchronously below instead of
   * through the effect: the manage page holds Edit / Prolong until this settles, and a plain model
   * launch used to wait out a whole catalogue round trip only to be told it matched nothing.
   */
  const declaredModel = !!identity && isModelAppType(identity.appType);

  useEffect(() => {
    if (key === null || declaredModel || !isReady || attempt >= MAX_ATTEMPTS) {
      // Nothing is in flight on any of these paths. Say so explicitly: an in-flight fetch that was
      // cancelled (by `job` blinking to null, say) resolves behind `if (!cancelled)` and so never
      // clears this itself, which would leave the Model card reading "Loading model…" forever.
      setMatching(false);
      return;
    }
    const { metadata, image, dockerCmd } = jobRef.current ?? {};
    const controller = new AbortController();
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setMatching(true);
    (async () => {
      try {
        const templates = await fetchTemplates(getServiceTemplates, controller.signal);
        const match = matchTemplateForService(templates, { metadata, image, dockerCmd });
        if (!cancelled) {
          setState({
            key,
            template: match.template,
            // A metadata match names the entry outright; a command match is the only other source
            // that identifies the variant (see matchTemplateForService).
            exact: match.source === 'metadata' || match.source === 'command',
            ambiguous: match.ambiguous,
            declared: match.source === 'metadata',
            failed: false,
          });
        }
      } catch (error) {
        // A transient catalogue failure shouldn't permanently strand the caller — retry a bounded
        // number of times, then record the FAILURE rather than a null match. The two are not the
        // same: a catalogue that answered "nothing matches this image" means the service is a plain
        // model service, while a catalogue we never reached means we don't know what it is. Reporting
        // the second as the first would send a template service's Edit into the model flow.
        if (!cancelled) {
          console.error('Failed to match this service back to a template:', error);
          if (attempt + 1 >= MAX_ATTEMPTS) {
            setState({ key, template: null, exact: false, ambiguous: false, declared: false, failed: true });
          } else {
            retryTimer = setTimeout(() => setAttempt((n) => n + 1), RETRY_DELAY_MS);
          }
        }
      } finally {
        if (!cancelled) {
          setMatching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [key, declaredModel, isReady, getServiceTemplates, attempt]);

  // A declared model service is its own answer — see declaredModel. Reported before `state` is
  // consulted, so it needs neither a catalogue nor a settled effect.
  if (declaredModel) {
    return {
      template: null,
      matching: false,
      exact: true,
      ambiguous: false,
      declared: true,
      settled: true,
      failed: false,
    };
  }

  // Only ever report an answer that belongs to the container currently passed in.
  const answered = key !== null && state.key === key;
  return {
    template: answered ? state.template : null,
    matching,
    exact: answered ? state.exact : false,
    ambiguous: answered && state.ambiguous,
    declared: answered && state.declared,
    // Nothing to match is not a settled match, and a match that gave up has no answer to settle on
    // (see `failed`).
    settled: answered && !state.failed,
    failed: answered && state.failed,
  };
};

export default useJobTemplate;
