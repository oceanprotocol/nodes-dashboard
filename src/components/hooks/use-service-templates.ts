import { useP2P } from '@/contexts/P2PContext';
import { fetchTemplates } from '@/services/service-templates';
import { AppTemplate } from '@/types/templates';
import { useEffect, useRef, useState } from 'react';

type ServiceTemplatesState = {
  templates: AppTemplate[];
  loading: boolean;
  /** Set only when the fetch failed (node unreachable / malformed payload). */
  error: string | null;
};

/**
 * Load the default node's advertised app templates. Aborts in-flight on unmount. Mirrors
 * use-default-model-packages, but a single node and returning the templates verbatim (no per-node
 * dedupe — one catalog).
 *
 * Deliberately NOT gated on the P2P node being ready: fetchTemplates reaches the catalogue over plain
 * HTTP first and only falls back to libp2p (see its transport ladder), so waiting for `isReady` would
 * make every cold catalogue load sit through a libp2p startup the faster path never needs. `isReady`
 * is still a dependency — becoming ready is worth a retry, since it unlocks the fallback rung for a
 * first attempt that failed.
 */
const useServiceTemplates = (): ServiceTemplatesState => {
  const { isReady, getServiceTemplates } = useP2P();
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // What's already rendered, readable inside the effect without making it depend on its own output.
  const loadedRef = useRef<AppTemplate[]>([]);
  loadedRef.current = templates;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      // Don't re-enter the loading state for the retry that `isReady` flipping triggers: the catalogue
      // is already on screen by then (served from fetchTemplates' cache in the same tick), and
      // flipping back would blank a rendered grid for a frame. Read through a ref rather than adding
      // `templates` to the dep list, which would re-run this effect on its own result.
      if (loadedRef.current.length === 0) {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await fetchTemplates(getServiceTemplates, controller.signal);
        if (!cancelled) {
          setTemplates(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch service templates:', err);
          setError(err instanceof Error ? err.message : 'Failed to load templates.');
          // Keep whatever is already rendered. A failure here is a failed RETRY (the first attempt
          // succeeded, or there'd be nothing to keep), and replacing a good catalogue with an empty
          // grid is strictly worse than leaving it up alongside the error.
          if (loadedRef.current.length === 0) {
            setTemplates([]);
          }
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isReady, getServiceTemplates]);

  return { templates, loading, error };
};

export default useServiceTemplates;
