import { SHOWCASE_ENTRIES } from '@/data/showcase';
import { PLACEHOLDER_SHOWCASE_ITEMS } from '@/mock/showcase-items';
import { detailsPath, INFERENCE_PATHS } from '@/services/inference-url';
import { ShowcaseEntry, ShowcaseItem, ShowcaseSource } from '@/types/showcase';

const SHOWCASE_DIR = '/showcase';

const SOURCE_CATALOGUES: Record<ShowcaseSource['kind'], string> = {
  template: INFERENCE_PATHS.templates,
  service: INFERENCE_PATHS.services,
  package: INFERENCE_PATHS.packages,
};

const toItem = ({ file, poster, ...entry }: ShowcaseEntry): ShowcaseItem => ({
  ...entry,
  src: `${SHOWCASE_DIR}/${file}`,
  poster: poster ? `${SHOWCASE_DIR}/${poster}` : undefined,
});

const GENERATED_ITEMS: ShowcaseItem[] = SHOWCASE_ENTRIES.map(toItem);

/** Every showcase item, placeholders included, for the carousels that aren't tied to one source. */
export const SHOWCASE_ITEMS: ShowcaseItem[] = [...GENERATED_ITEMS, ...PLACEHOLDER_SHOWCASE_ITEMS];

export const showcaseSourceHref = (source: ShowcaseSource): string =>
  detailsPath(SOURCE_CATALOGUES[source.kind], source.id);

export const showcaseItemsForSource = (kind: ShowcaseSource['kind'], id: string): ShowcaseItem[] =>
  GENERATED_ITEMS.filter((item) => item.source.kind === kind && item.source.id === id);
