import { firstQueryValue } from '@/services/inference-url';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Query key naming the open item. Deliberately not `template`/`package`/etc.: the inference context
 * hydrates its selection from those keys on every page, so reusing one here would commit the viewed
 * item to context (and report a dead link as `inference_hydration_failed`).
 */
const VIEW_PARAM = 'view';

type UseUrlSelectionArgs<T> = {
  items: T[];
  /** False while `items` is still loading (or failed): an id can't be judged unknown until then. */
  loaded: boolean;
  /**
   * The URL opened an item this page didn't open itself: a shared link, a reload, Back/Forward.
   * Clicks go through `open()` and never reach here, so a caller's click handling isn't doubled.
   */
  onOpenFromUrl?: (item: T) => void;
};

/**
 * Keeps a page's details modal in the URL (`?view=<id>`), so the link to an open modal can be
 * shared and reopens it. The URL is the only source of truth for which item is open: `open()` pushes
 * the param (Back closes the modal), `close()` drops it. Updates are shallow — no data refetch.
 */
export default function useUrlSelection<T extends { id: string }>({
  items,
  loaded,
  onOpenFromUrl,
}: UseUrlSelectionArgs<T>) {
  const router = useRouter();
  const id = router.isReady ? firstQueryValue(router.query[VIEW_PARAM]) : undefined;
  const selected = useMemo(() => (id ? (items.find((item) => item.id === id) ?? null) : null), [id, items]);

  // True while the history entry holding the param is one open() pushed during this mount — close()
  // then pops it, so Back after closing doesn't land on the same modal again.
  const pushedRef = useRef(false);
  // The id already accounted for, so a click-open isn't reported again as a URL-open once the URL catches up.
  const handledIdRef = useRef<string | null>(null);
  const onOpenFromUrlRef = useRef(onOpenFromUrl);
  onOpenFromUrlRef.current = onOpenFromUrl;

  const withoutParam = useCallback(() => {
    const query = { ...router.query };
    delete query[VIEW_PARAM];
    return query;
  }, [router.query]);

  useEffect(() => {
    if (!router.isReady || !loaded) {
      return;
    }
    if (!id) {
      handledIdRef.current = null;
      pushedRef.current = false;
      return;
    }
    if (!selected) {
      // Unknown or no-longer-listed id: drop it rather than leave a param that opens nothing.
      router.replace({ pathname: router.pathname, query: withoutParam() }, undefined, { shallow: true });
      return;
    }
    if (handledIdRef.current === id) {
      return;
    }
    handledIdRef.current = id;
    onOpenFromUrlRef.current?.(selected);
    // router is intentionally not a dep: including it re-runs on every query change we just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, loaded, id, selected]);

  const open = useCallback(
    (item: T) => {
      handledIdRef.current = item.id;
      pushedRef.current = true;
      router.push({ pathname: router.pathname, query: { ...router.query, [VIEW_PARAM]: item.id } }, undefined, {
        shallow: true,
      });
    },
    [router]
  );

  const close = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
      return;
    }
    router.replace({ pathname: router.pathname, query: withoutParam() }, undefined, { shallow: true });
  }, [router, withoutParam]);

  return { selected, open, close };
}
