import { useP2P } from '@/contexts/P2PContext';
import { fetchTemplates } from '@/services/service-templates';
import { AppTemplate } from '@/types/templates';
import { useEffect, useState } from 'react';

type ServiceTemplatesState = {
  templates: AppTemplate[];
  loading: boolean;
  /** Set only when the fetch failed (node unreachable / malformed payload). */
  error: string | null;
};

/**
 * Load the default node's advertised app templates (getServiceTemplates) once the P2P node is ready.
 * Aborts in-flight on unmount. Mirrors use-default-model-packages, but a single node and returning the
 * templates verbatim (no per-node dedupe — one catalog).
 */
const useServiceTemplates = (): ServiceTemplatesState => {
  const { isReady, getServiceTemplates } = useP2P();
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // getServiceTemplates throws until the P2P node is ready, so there is nothing to fetch yet.
    if (!isReady) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
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
          setTemplates([]);
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
