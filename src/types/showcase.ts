/**
 * What a showcase item was generated with: a catalogue entry on the platform. `id` is the entry's id as
 * the nodes advertise it (template/service id, or package id), so its details page can be linked and
 * filtered by it.
 */
export type ShowcaseSource = {
  kind: 'template' | 'service' | 'package';
  id: string;
  /** Name shown on the tile's chip. Stored here because catalogue entries are only known at runtime. */
  label: string;
};

/** One showcase entry as authored in `src/data/showcase.ts`. */
export type ShowcaseEntry = {
  /** Unique slug; also the media's filename stem in `public/showcase/`. */
  id: string;
  type: 'image' | 'video';
  /** Filename in `public/showcase/`. */
  file: string;
  /** Still shown before a video has loaded a frame, filename in `public/showcase/`. */
  poster?: string;
  /** Intrinsic size of the media. Only the ratio is used, to size the tile. */
  width: number;
  height: number;
  alt: string;
  source: ShowcaseSource;
  /** Prompt used for the generation. */
  prompt?: string;
};

/** One generated image or video shown as an example of what a template, service or package makes. */
export type ShowcaseItem = Omit<ShowcaseEntry, 'file' | 'poster'> & {
  src: string;
  poster?: string;
};
