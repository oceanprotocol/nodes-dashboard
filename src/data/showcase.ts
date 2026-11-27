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

export const PRODUCT_STUDIO_QWEN_IMAGE: ShowcaseSource = {
  kind: 'template',
  id: 'product-studio-qwen-image',
  label: 'Product Studio · Qwen Image',
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
    file: 'Video Generator.mp4',
    width: 1344,
    height: 768,
    alt: 'Gift wrapped in newspaper and tape with a red bow on a marble table',
    source: VIDEO_STUDIO_MINIMAX_H3,
  },
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
  {
    id: 'ecom-forest-background',
    type: 'image',
    file: 'ecom_background_00002_.png',
    width: 896,
    height: 1344,
    alt: 'Glass perfume bottle on a mossy stone in a sunlit forest',
    source: PRODUCT_STUDIO_QWEN_IMAGE,
  },
  {
    id: 'ecom-sale-poster',
    type: 'image',
    file: 'ecom_creative_00001_.png',
    width: 896,
    height: 1344,
    alt: 'Summer sale poster with a 30% off headline above the perfume bottle',
    source: PRODUCT_STUDIO_QWEN_IMAGE,
  },
  {
    id: 'ecom-turntable',
    type: 'image',
    file: 'ecom_turntable_00001_.webp',
    width: 896,
    height: 1344,
    alt: 'Perfume bottle turning on a marble plinth above the clouds',
    source: PRODUCT_STUDIO_QWEN_IMAGE,
  },
  {
    id: 'ecom-motion',
    type: 'video',
    file: 'ecom_motion_00001_.mp4',
    width: 704,
    height: 1280,
    alt: 'Perfume bottle on a marble plinth with clouds drifting behind it',
    source: PRODUCT_STUDIO_QWEN_IMAGE,
  },
  {
    id: 'ugc-kitchen-review',
    type: 'video',
    file: 'UGC Reel Maker.mp4',
    width: 768,
    height: 1344,
    alt: 'Woman with lavender hair talking to the camera in a kitchen while holding a product',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'ugc-bathrobe-phone',
    type: 'video',
    file: 'UGC_Reel Maker_1.mp4',
    width: 608,
    height: 1056,
    alt: 'Man in a bathrobe smiling at his phone, with on-screen captions',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'ugc-noodles',
    type: 'video',
    file: 'UGC_Reel Maker_2.mp4',
    width: 608,
    height: 1056,
    alt: 'Woman with red hair and glasses eating noodles from a takeout box',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'ugc-neon-cash',
    type: 'video',
    file: 'UGC_Reel Maker_3.mp4',
    width: 608,
    height: 1056,
    alt: 'Woman in sunglasses throwing cash in a room lit by neon palm and flamingo signs',
    source: UGC_REEL_MINIMAX_H3,
  },
  {
    id: 'music-drifting-thoughts',
    type: 'video',
    file: 'Music Generator.mp4',
    width: 1280,
    height: 720,
    alt: 'Retro music player playing Drifting Thoughts, a generated track',
    source: MUSIC_GENERATOR_MINIMAX_MUSIC3,
    audio: true,
  },
];
