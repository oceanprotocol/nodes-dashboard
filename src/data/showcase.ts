import { ShowcaseEntry, ShowcaseSource } from '@/types/showcase';

/**
 * Generations shown in the showcase carousels (homepage hero, inference index, details pages).
 *
 * To add one: drop the media into `public/showcase/`, then add an entry here with its intrinsic size
 * and the catalogue entry it was generated with. Videos can take a `poster` still from the same folder.
 */

const VIDEO_STUDIO_MINIMAX_H3: ShowcaseSource = {
  kind: 'template',
  id: 'video-studio-minimax-h3',
  label: 'Video Studio · MiniMax H3',
};

export const SHOWCASE_ENTRIES: ShowcaseEntry[] = [
  {
    id: 'paper-ocean',
    type: 'video',
    file: 'h3_00052_.mp4',
    width: 960,
    height: 544,
    alt: 'Paper-craft underwater scene with an astronaut girl, a cat in a space helmet and a glowing jellyfish',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'anime-wheat-field',
    type: 'video',
    file: 'Anime_Guy_and_Dog.mp4',
    width: 960,
    height: 544,
    alt: 'Anime-style man running with a small dog through a wheat field at sunset',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'gpu-heatsink',
    type: 'video',
    file: 'GPU_Video.mp4',
    width: 960,
    height: 544,
    alt: 'Close-up of a graphics card with fans, copper heat pipes and drifting smoke',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'hummingbird-feeder',
    type: 'video',
    file: 'h3_00026_.mp4',
    width: 960,
    height: 544,
    alt: 'Hummingbird hovering at a red feeder in golden evening light',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'knitted-astronaut',
    type: 'video',
    file: 'h3_00030_.mp4',
    width: 960,
    height: 544,
    alt: 'Knitted astronaut cheering next to a blue flag on the moon',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'gpu-blueprint',
    type: 'video',
    file: 'h3_00127_.mp4',
    width: 960,
    height: 544,
    alt: 'Graphics card lying on technical blueprint drawings',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'spider-web-dew',
    type: 'video',
    file: 'h3_00038_.mp4',
    width: 960,
    height: 544,
    alt: 'Spider in a dew-covered web at dawn',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
];
