import { ShowcaseEntry, ShowcaseSource } from '@/types/showcase';

/**
 * Generations shown in the showcase carousels (homepage hero, inference index, details pages).
 *
 * To add one: drop the media into `public/showcase/` named `<source id>-<n>` (e.g. `ugc-reel-minimax-h3-5.mp4`),
 * then add an entry here with its intrinsic size and the catalogue entry it was generated with. Videos can take a
 * `poster` still from the same folder.
 */

const VIDEO_STUDIO_MINIMAX_H3: ShowcaseSource = {
  kind: 'template',
  id: 'video-studio-minimax-h3',
  label: 'Video Studio · MiniMax H3',
};

const UGC_REEL_MINIMAX_H3: ShowcaseSource = {
  kind: 'template',
  id: 'ugc-reel-minimax-h3',
  label: 'UGC Reel · MiniMax H3',
};

const MUSIC_GENERATOR_MINIMAX_MUSIC3: ShowcaseSource = {
  kind: 'template',
  id: 'music-generator-minimax-music3',
  label: 'Music Generator · MiniMax Music 3',
};

export const SHOWCASE_ENTRIES: ShowcaseEntry[] = [
  {
    id: 'newspaper-gift',
    type: 'video',
    file: 'video-studio-minimax-h3-1.mp4',
    width: 1344,
    height: 768,
    alt: 'Gift wrapped in newspaper and tape with a red bow on a marble table',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'paper-ocean',
    type: 'video',
    file: 'video-studio-minimax-h3-2.mp4',
    width: 960,
    height: 544,
    alt: 'Paper-craft underwater scene with an astronaut girl, a cat in a space helmet and a glowing jellyfish',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'anime-wheat-field',
    type: 'video',
    file: 'video-studio-minimax-h3-3.mp4',
    width: 960,
    height: 544,
    alt: 'Anime-style man running with a small dog through a wheat field at sunset',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'gpu-heatsink',
    type: 'video',
    file: 'video-studio-minimax-h3-4.mp4',
    width: 960,
    height: 544,
    alt: 'Close-up of a graphics card with fans, copper heat pipes and drifting smoke',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'hummingbird-feeder',
    type: 'video',
    file: 'video-studio-minimax-h3-5.mp4',
    width: 960,
    height: 544,
    alt: 'Hummingbird hovering at a red feeder in golden evening light',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'knitted-astronaut',
    type: 'video',
    file: 'video-studio-minimax-h3-6.mp4',
    width: 960,
    height: 544,
    alt: 'Knitted astronaut cheering next to a blue flag on the moon',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'gpu-blueprint',
    type: 'video',
    file: 'video-studio-minimax-h3-7.mp4',
    width: 960,
    height: 544,
    alt: 'Graphics card lying on technical blueprint drawings',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'spider-web-dew',
    type: 'video',
    file: 'video-studio-minimax-h3-8.mp4',
    width: 960,
    height: 544,
    alt: 'Spider in a dew-covered web at dawn',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
  {
    id: 'ugc-kitchen-review',
    type: 'video',
    file: 'ugc-reel-minimax-h3-1.mp4',
    width: 768,
    height: 1344,
    alt: 'Woman with lavender hair talking to the camera in a kitchen while holding a product',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'ugc-bathrobe-phone',
    type: 'video',
    file: 'ugc-reel-minimax-h3-2.mp4',
    width: 608,
    height: 1056,
    alt: 'Man in a bathrobe smiling at his phone, with on-screen captions',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'ugc-noodles',
    type: 'video',
    file: 'ugc-reel-minimax-h3-3.mp4',
    width: 608,
    height: 1056,
    alt: 'Woman with red hair and glasses eating noodles from a takeout box',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'ugc-neon-cash',
    type: 'video',
    file: 'ugc-reel-minimax-h3-4.mp4',
    width: 608,
    height: 1056,
    alt: 'Woman in sunglasses throwing cash in a room lit by neon palm and flamingo signs',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'music-drifting-thoughts',
    type: 'video',
    file: 'music-generator-minimax-music3-1.mp4',
    width: 1920,
    height: 1080,
    alt: 'Retro music player playing Drifting Thoughts, a generated track',
    source: MUSIC_GENERATOR_MINIMAX_MUSIC3,
    audio: true,
  },
];
