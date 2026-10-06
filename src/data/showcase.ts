import { ShowcaseEntry } from '@/types/showcase';

/**
 * Generations shown in the showcase carousels (homepage hero, inference index, details pages).
 *
 * To add one: drop the media into `public/showcase/` (named after the entry's `id`, e.g.
 * `flux-portrait.jpg`, `ltx-city.mp4` with `ltx-city-poster.jpg`), then add an entry here with
 * its intrinsic size and the catalogue entry it was generated with.
 *
 * Example:
 * {
 *   id: 'comfyui-sdxl-portrait',
 *   type: 'image',
 *   file: 'comfyui-sdxl-portrait.webp',
 *   width: 832,
 *   height: 1216,
 *   alt: 'Portrait of a lighthouse keeper in oil paint',
 *   source: { kind: 'template', id: 'comfyui-sdxl', label: 'ComfyUI · SDXL' },
 *   prompt: 'oil painting, portrait of a lighthouse keeper, dramatic light',
 * }
 */
export const SHOWCASE_ENTRIES: ShowcaseEntry[] = [
  {
    id: 'video-studio-minimax-h3-paper-ocean',
    type: 'video',
    file: 'h3_00052_.mp4',
    width: 960,
    height: 544,
    alt: 'Paper-craft underwater scene with an astronaut girl, a cat in a space helmet and a glowing jellyfish',
    source: { kind: 'template', id: 'video-studio-minimax-h3', label: 'Video Studio · MiniMax H3' },
  },
];
