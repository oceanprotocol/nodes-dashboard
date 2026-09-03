import type { ResolvedTheme } from '@/lib/use-theme';
import { AppTemplate } from '@/types/templates';
import type { SvgIconComponent } from '@mui/icons-material';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import DnsOutlined from '@mui/icons-material/DnsOutlined';
import GrainOutlined from '@mui/icons-material/GrainOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import MenuBook from '@mui/icons-material/MenuBook';
import MovieOutlined from '@mui/icons-material/MovieOutlined';

/**
 * Visual identity of an app template: its category (the picker's primary filter axis), the accent that
 * tints its icon tile / category pill, and its brand mark. The node's template catalogue carries no
 * category, logo or colour, so all three are derived here from the template `id` (a substring match
 * against a small maintained map). An id that matches nothing falls back to the neutral `app` bucket
 * with a 2-letter monogram — nothing breaks, it just reads as "uncategorised".
 */

export type TemplateCategory = 'image' | 'video' | 'llm' | 'serving' | 'notebook' | 'embeddings' | 'app';

export interface TemplateCategoryMeta {
  label: string;
  /**
   * Accent per theme. `--accent` is used mostly as *text* on a 12%-alpha tint of itself, so the
   * light values are mid-to-dark hues; dark takes lifted siblings of the same hue.
   */
  accent: { dark: string; light: string };
  Icon: SvgIconComponent;
  /** "What you get" lead line in the details modal — the node publishes no such field per template. */
  purpose: string;
  /**
   * How you interact with the running app, for the card's highlighted chip. Every template exposes at
   * least one port (the node's schema enforces `exposedPorts.min(1)`), so "has a port" says nothing —
   * what differs is whether that port serves a browser app or an HTTP API, which only the category knows.
   */
  interaction: string;
  /** Trailing hint next to the port row in the details modal — what to do with that port. */
  interactionHint: string;
}

/**
 * Category → label / accent / glyph. `image` reuses --accent1 coral and `llm` the readable lime; video
 * takes a violet that sits opposite coral without competing with it, serving a deep teal-green sibling
 * of the lime (so the two model buckets read as related), and the `app` fallback a neutral slate —
 * deliberately the least eye-catching of the set. The dark values keep those relationships at a
 * lightness that survives the near-black page.
 */
export const CATEGORY_META: Record<TemplateCategory, TemplateCategoryMeta> = {
  image: {
    label: 'Image gen',
    accent: { dark: '#f2776c', light: '#d54335' },
    Icon: ImageOutlined,
    purpose: 'For generating and editing images.',
    interaction: 'Web UI',
    interactionHint: 'opens in your browser once the session is running',
  },
  video: {
    label: 'Video gen',
    accent: { dark: '#b69bff', light: '#7b3fe4' },
    Icon: MovieOutlined,
    purpose: 'For generating short video clips.',
    interaction: 'Web UI',
    interactionHint: 'opens in your browser once the session is running',
  },
  llm: {
    label: 'LLM chat',
    accent: { dark: '#9ae84f', light: '#4f9a10' },
    Icon: ChatBubbleOutline,
    purpose: 'For chatting with a model in your browser.',
    interaction: 'Web UI',
    interactionHint: 'opens in your browser once the session is running',
  },
  serving: {
    label: 'LLM serving',
    accent: { dark: '#4fd6bd', light: '#0f7b6c' },
    Icon: DnsOutlined,
    purpose: 'For serving an OpenAI-compatible model endpoint.',
    interaction: 'API',
    interactionHint: 'call it from your code once the session is running',
  },
  notebook: {
    label: 'Notebook',
    // Black has no lifted sibling, so dark inverts to a warm near-white instead.
    accent: { dark: '#ece7e2', light: '#000000' },
    Icon: MenuBook,
    purpose: 'For notebooks, scripting and data exploration.',
    interaction: 'Web UI',
    interactionHint: 'opens in your browser once the session is running',
  },
  embeddings: {
    label: 'Embeddings',
    accent: { dark: '#ffb04d', light: '#c96b00' },
    Icon: GrainOutlined,
    purpose: 'For building a vector index or a RAG pipeline.',
    interaction: 'API',
    interactionHint: 'call it from your code once the session is running',
  },
  app: {
    label: 'App',
    accent: { dark: '#9aa9b8', light: '#5a6b7a' },
    Icon: AppsOutlined,
    purpose: 'This node published the image without a recognised category.',
    // Uncategorised: an exposed port is all that's known, so promise nothing about what serves it.
    interaction: 'Endpoint',
    interactionHint: 'reachable once the session is running',
  },
};

/**
 * Inline style setting `--accent` for a tile/pill/header — pass `resolvedTheme` from `useTheme()`.
 *
 * Don't replace this with CSS `light-dark()`: it resolves against `color-scheme`, and the CSS
 * pipeline compiles it into `prefers-color-scheme` queries, so the accents would follow the OS even
 * when the user has pinned a theme.
 */
export function accentVars(accent: TemplateCategoryMeta['accent'], theme: ResolvedTheme): Record<string, string> {
  return { '--accent': theme === 'dark' ? accent.dark : accent.light };
}

/** Pill order in the filter toolbar (buckets with no templates are still rendered, dimmed, at 0). */
export const CATEGORY_ORDER: TemplateCategory[] = ['image', 'video', 'llm', 'serving', 'notebook', 'embeddings', 'app'];

/** id-substring → category. Extend as new templates ship; unknown ids fall back to `app`. */
const CATEGORY_BY_ID_PART: Record<string, TemplateCategory> = {
  automatic1111: 'image',
  a1111: 'image',
  'stable-diffusion': 'image',
  'sd-webui': 'image',
  comfyui: 'image',
  fooocus: 'image',
  flux: 'image',
  'wan-video': 'video',
  'ltx-video': 'video',
  animatediff: 'video',
  video: 'video',
  jupyter: 'notebook',
  // Longer than `vllm`, so a `vllm-nomic-embed` id resolves to Embeddings (see MATCH_KEYS sort).
  'nomic-embed': 'embeddings',
  embed: 'embeddings',
  'open-webui': 'llm',
  ollama: 'llm',
  llamacpp: 'llm',
  'llama-cpp': 'llm',
  'llama.cpp': 'llm',
  chat: 'llm',
  vllm: 'serving',
  tgi: 'serving',
  'text-generation-inference': 'serving',
};

// Longest key first so the most specific substring wins (e.g. `nomic-embed` over `vllm`).
const MATCH_KEYS = Object.keys(CATEGORY_BY_ID_PART).sort((a, b) => b.length - a.length);

export interface TemplateVisual {
  category: TemplateCategory;
  meta: TemplateCategoryMeta;
  /** 2-letter monogram, set only for uncategorised templates (the tile has no glyph to show instead). */
  mono: string | null;
}

/**
 * Visual for a template. The node's own `category` wins when it publishes one — that is what lets a
 * node ship a service we've never heard of and still have it land in the right filter pill. The
 * id-substring map is the fallback for templates published before the field existed (or by a node
 * that doesn't set it), and an id matching neither falls back to `app` + a monogram.
 */
export function visualFor(id: string, category?: string): TemplateVisual {
  if (category && category in CATEGORY_META) {
    const declared = category as TemplateCategory;
    return { category: declared, meta: CATEGORY_META[declared], mono: null };
  }
  const key = MATCH_KEYS.find((k) => id.toLowerCase().includes(k));
  if (key) {
    const derived = CATEGORY_BY_ID_PART[key];
    return { category: derived, meta: CATEGORY_META[derived], mono: null };
  }
  const mono = id
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
  return { category: 'app', meta: CATEGORY_META.app, mono: mono || '??' };
}

export interface TemplateHardware {
  /** True when the template declares a GPU resource — the main GPU-vs-CPU signal on the card. */
  gpu: boolean;
  /** GPU units the template asks for (0 when it declares none) — the recommended count, else min. */
  gpuUnits: number;
  /** Declared GPU floor (0 when none declared) — the low end of the card's `min-max GPUs` label. */
  gpuMin: number;
  /** Recommended (else min) CPU cores, if the template declares them. */
  cpu?: number;
  /** Recommended (else min) RAM in GB, if the template declares it. */
  ram?: number;
  /** Recommended (else min) disk in GB, if the template declares it. */
  disk?: number;
}

/**
 * Hardware signal for a card. Prefers `recommendedResources`, falling back to `requiredResources`
 * (same precedence as the resources step's sizing). GPU is detected by a `gpu`-typed resource entry.
 */
export function templateHardware(tpl: AppTemplate): TemplateHardware {
  const reqs = tpl.recommendedResources ?? tpl.requiredResources ?? [];
  const amount = (id: string): number | undefined => {
    const entry = reqs.find((r) => r.id === id);
    return entry ? (entry.recommended ?? entry.min) : undefined;
  };
  const gpuEntry = reqs.find((r) => r.type === 'gpu' || r.id === 'gpu');
  return {
    gpu: !!gpuEntry,
    gpuUnits: gpuEntry ? (gpuEntry.recommended ?? gpuEntry.min ?? 0) : 0,
    gpuMin: gpuEntry ? (gpuEntry.min ?? 0) : 0,
    cpu: amount('cpu'),
    ram: amount('ram'),
    disk: amount('disk'),
  };
}

/**
 * The hardware chip's label — the GPU ask alone: the declared range ("2-4 GPUs"), a single count
 * ("1 GPU") when min and recommended agree, or "CPU only" when no GPU is declared. Shared so the
 * catalogue card and the details modal name the same ask in the same words.
 */
export function templateGpuLabel(hw: TemplateHardware): string {
  if (!hw.gpu) {
    return 'CPU only';
  }
  const rec = hw.gpuUnits || hw.gpuMin;
  if (hw.gpuMin > 0 && rec > hw.gpuMin) {
    return `${hw.gpuMin}-${rec} GPUs`;
  }
  const n = rec || 1;
  return `${n} ${n === 1 ? 'GPU' : 'GPUs'}`;
}

/**
 * Who publishes the image, for the card's subtitle: the registry namespace (the path segment before
 * the image name), with bare registry hosts collapsed to "registry" since they name no one. An image
 * with no namespace at all (`nginx`) is shown as-is.
 */
export function templateVendor(image: string): string {
  if (!image.includes('/')) {
    return image;
  }
  const namespace = image.split('/').slice(-2)[0];
  return /^(ghcr\.io|docker\.io|quay\.io|registry\.[^/]+|.*\..*:\d+)$/.test(namespace) ? 'registry' : namespace;
}

/** `image:tag` (or `image@checksum`) as published by the node — shown verbatim in the details modal. */
export function templateImageRef(tpl: AppTemplate): string {
  if (tpl.tag) {
    return `${tpl.image}:${tpl.tag}`;
  }
  if (tpl.checksum) {
    return `${tpl.image}@${tpl.checksum}`;
  }
  return tpl.image;
}
