import { detailsPath, firstQueryValue } from '@/services/inference-url';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Catalogue links from before details were pages opened a modal with `<catalogue>?view=<id>`. Keeps
 * those shared links working by sending them on to the entry's details page, replacing the history
 * entry so Back doesn't bounce off the catalogue again. An id that isn't listed there gets the details
 * page's own not-found state, and a template linked under the other catalogue its redirect.
 */
export default function useLegacyViewRedirect(catalogue: string) {
  const router = useRouter();
  const id = router.isReady ? firstQueryValue(router.query.view) : undefined;

  useEffect(() => {
    if (id) {
      router.replace(detailsPath(catalogue, id));
    }
    // router is intentionally not a dep: it changes on the navigation this triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, catalogue]);
}
