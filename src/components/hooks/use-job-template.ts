import { useP2P } from '@/contexts/P2PContext';
import { fetchTemplates, findTemplateForService } from '@/services/service-templates';
import { AppTemplate } from '@/types/templates';
import { useEffect, useRef, useState } from 'react';

/** The container facts a running service is matched back to the catalogue by. */
type JobContainer = {
  image?: string;
  dockerCmd?: string[];
};

type JobTemplateState = {
  /** The matched catalogue entry, or null while unmatched / unmatchable. */
  template: AppTemplate | null;
  /** A match is in flight — callers wait it out rather than claiming "unknown" too early. */
  matching: boolean;
};

/**
 * Match a running service back to the template it was launched from, using the node's own job record.
 *
 * Needed because the URL doesn't always say: the manage page only gets `template=` when the BACKEND
 * session record held enough to match (its listing strips `dockerCmd`, and a record with no `image`
 * matches nothing), and an in-flow redirect can drop the query altogether. Without a match the page
 * falls through to the Model card and claims "Unknown model" for an app that serves no model at all.
 *
 * The job record always names image + dockerCmd, which is what distinguishes a bundle from its parent
 * service (they share the image and differ only in `command`).
 *
 * @param job    container facts from the polled job record — a fresh object every tick, so the lookup
 *               is keyed on the facts themselves and not repeated while they're unchanged.
 * @param skip   true when the caller already knows the template (the URL carried one).
 */
const useJobTemplate = (job: JobContainer | null, skip = false): JobTemplateState => {
  const { isReady, getServiceTemplates } = useP2P();
  const [template, setTemplate] = useState<AppTemplate | null>(null);
  const [matching, setMatching] = useState(false);
  const matchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (skip || !job || !isReady) {
      return;
    }
    // NUL-joined: a delimiter no image ref or argv entry can itself contain.
    const key = [job.image ?? '', ...(job.dockerCmd ?? [])].join('\u0000');
    if (matchedKeyRef.current === key) {
      return;
    }
    matchedKeyRef.current = key;
    let cancelled = false;
    setMatching(true);
    (async () => {
      try {
        const templates = await fetchTemplates(getServiceTemplates);
        const match = findTemplateForService(templates, { image: job.image, dockerCmd: job.dockerCmd });
        if (!cancelled) {
          setTemplate(match);
        }
      } catch (error) {
        // Let the next poll retry: a transient catalogue failure shouldn't permanently strand the
        // caller on its no-template path.
        matchedKeyRef.current = null;
        console.error('Failed to match this service back to a template:', error);
      } finally {
        if (!cancelled) {
          setMatching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skip, job, isReady, getServiceTemplates]);

  return { template, matching };
};

export default useJobTemplate;
