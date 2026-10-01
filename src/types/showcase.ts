/** One generated image or video shown as an example of what a template or model makes. */
export type ShowcaseItem = {
  id: string;
  type: 'image' | 'video';
  src: string;
  /** Still shown before a video has loaded a frame. */
  poster?: string;
  /** Intrinsic size of the media. Only the ratio is used, to size the tile. */
  width: number;
  height: number;
  alt: string;
  /** Template or model name shown on the tile's chip. */
  model: string;
  /** Template id used to pick the chip's brand mark. Falls back to matching on `model`. */
  templateId?: string;
  /** Makes the chip a link, e.g. to the template's page. */
  href?: string;
};

export type ShowcaseMedia = 'image' | 'video';

/** HF pipeline tags whose output is an image or a video; anything else (text, audio) has nothing to show. */
const PIPELINE_MEDIA: Record<string, ShowcaseMedia> = {
  'image-to-image': 'image',
  'image-to-video': 'video',
  'text-to-image': 'image',
  'text-to-video': 'video',
};

export const showcaseMediaForPipeline = (pipelineTag?: string): ShowcaseMedia | null =>
  (pipelineTag && PIPELINE_MEDIA[pipelineTag]) || null;
