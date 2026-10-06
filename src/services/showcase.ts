import { SHOWCASE_ENTRIES } from '@/data/showcase';
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

export const SHOWCASE_ITEMS: ShowcaseItem[] = SHOWCASE_ENTRIES.map(toItem);

export const showcaseSourceHref = (source: ShowcaseSource): string =>
  detailsPath(SOURCE_CATALOGUES[source.kind], source.id);

export const showcaseItemsForSource = (kind: ShowcaseSource['kind'], id: string): ShowcaseItem[] =>
  SHOWCASE_ITEMS.filter((item) => item.source.kind === kind && item.source.id === id);
