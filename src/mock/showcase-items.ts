import { ShowcaseItem } from '@/types/showcase';

/**
 * Placeholder generations shown next to the real ones in `src/data/showcase.ts`, on the homepage hero
 * and the inference index. MOCK DATA: remove once enough real generations are supplied.
 */

// Swap `src`/`width`/`height` per item; the showcases lay out any mix of ratios.
const placeholderImage = (seed: string, width: number, height: number) =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`;

const PLACEHOLDER_VIDEO = '/hero.mp4';
const PLACEHOLDER_VIDEO_ALT = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export const PLACEHOLDER_SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: 'flux-portrait',
    type: 'image',
    src: placeholderImage('ocean-flux-1', 800, 1000),
    width: 800,
    height: 1000,
    alt: 'Portrait generated with FLUX.1',
    source: { kind: 'template', id: 'flux-1-dev', label: 'FLUX.1 [dev]' },
  },
  {
    id: 'ltx-wide',
    type: 'video',
    src: PLACEHOLDER_VIDEO,
    width: 1920,
    height: 1080,
    alt: 'Video generated with LTX-Video',
    source: { kind: 'template', id: 'ltx-video', label: 'LTX-Video' },
  },
  {
    id: 'qwen-square',
    type: 'image',
    src: placeholderImage('ocean-qwen-1', 900, 900),
    width: 900,
    height: 900,
    alt: 'Image generated with Qwen-Image',
    source: { kind: 'template', id: 'qwen-image', label: 'Qwen-Image' },
  },
  {
    id: 'sdxl-tall',
    type: 'image',
    src: placeholderImage('ocean-sdxl-1', 800, 1200),
    width: 800,
    height: 1200,
    alt: 'Image generated with SDXL on ComfyUI',
    source: { kind: 'template', id: 'comfyui-sdxl', label: 'ComfyUI · SDXL' },
  },
  {
    id: 'wan-vertical',
    type: 'video',
    src: PLACEHOLDER_VIDEO_ALT,
    width: 1080,
    height: 1920,
    alt: 'Video generated with Wan 2.2',
    source: { kind: 'template', id: 'wan-2-2', label: 'Wan 2.2' },
  },
  {
    id: 'sd35-landscape',
    type: 'image',
    src: placeholderImage('ocean-sd35-1', 1200, 800),
    width: 1200,
    height: 800,
    alt: 'Image generated with Stable Diffusion 3.5',
    source: { kind: 'template', id: 'stable-diffusion-3-5', label: 'Stable Diffusion 3.5' },
  },
  {
    id: 'hunyuan-square',
    type: 'video',
    src: PLACEHOLDER_VIDEO,
    width: 1080,
    height: 1080,
    alt: 'Video generated with HunyuanVideo',
    source: { kind: 'template', id: 'hunyuanvideo', label: 'HunyuanVideo' },
  },
  {
    id: 'flux-schnell',
    type: 'image',
    src: placeholderImage('ocean-flux-2', 900, 1200),
    width: 900,
    height: 1200,
    alt: 'Image generated with FLUX.1 schnell',
    source: { kind: 'template', id: 'flux-1-schnell', label: 'FLUX.1 [schnell]' },
  },
  {
    id: 'ltx-cinema',
    type: 'video',
    src: PLACEHOLDER_VIDEO_ALT,
    width: 2390,
    height: 1000,
    alt: 'Cinematic video generated with LTX-Video',
    source: { kind: 'template', id: 'ltx-video', label: 'LTX-Video' },
  },
  {
    id: 'qwen-edit',
    type: 'image',
    src: placeholderImage('ocean-qwen-2', 1200, 900),
    width: 1200,
    height: 900,
    alt: 'Image edited with Qwen-Image-Edit',
    source: { kind: 'template', id: 'qwen-image-edit', label: 'Qwen-Image-Edit' },
  },
  {
    id: 'sdxl-turbo',
    type: 'image',
    src: placeholderImage('ocean-sdxl-2', 720, 1280),
    width: 720,
    height: 1280,
    alt: 'Image generated with SDXL Turbo on ComfyUI',
    source: { kind: 'template', id: 'comfyui-sdxl', label: 'ComfyUI · SDXL Turbo' },
  },
  {
    id: 'wan-portrait',
    type: 'video',
    src: PLACEHOLDER_VIDEO,
    width: 1080,
    height: 1350,
    alt: 'Video generated with Wan 2.2',
    source: { kind: 'template', id: 'wan-2-2', label: 'Wan 2.2' },
  },
  {
    id: 'hidream-wide',
    type: 'image',
    src: placeholderImage('ocean-hidream-1', 1600, 900),
    width: 1600,
    height: 900,
    alt: 'Image generated with HiDream-I1',
    source: { kind: 'template', id: 'hidream-i1', label: 'HiDream-I1' },
  },
  {
    id: 'flux-kontext',
    type: 'image',
    src: placeholderImage('ocean-flux-3', 1000, 1000),
    width: 1000,
    height: 1000,
    alt: 'Image edited with FLUX.1 Kontext',
    source: { kind: 'template', id: 'flux-1-kontext', label: 'FLUX.1 Kontext' },
  },
  {
    id: 'ltx-portrait',
    type: 'video',
    src: PLACEHOLDER_VIDEO_ALT,
    width: 1080,
    height: 1440,
    alt: 'Video generated with LTX-Video',
    source: { kind: 'template', id: 'ltx-video', label: 'LTX-Video' },
  },
  {
    id: 'qwen-landscape',
    type: 'image',
    src: placeholderImage('ocean-qwen-3', 1250, 1000),
    width: 1250,
    height: 1000,
    alt: 'Image generated with Qwen-Image',
    source: { kind: 'template', id: 'qwen-image', label: 'Qwen-Image' },
  },
];
