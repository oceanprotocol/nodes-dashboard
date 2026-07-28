import { AppTemplate } from '@/types/templates';
import type { SvgIconComponent } from '@mui/icons-material';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import GrainOutlined from '@mui/icons-material/GrainOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import MenuBook from '@mui/icons-material/MenuBook';

/**
 * Visual identity for a template card. The node's template catalogue carries no logo/category/color,
 * so we derive them here from the template `id` (a substring match against a small maintained map).
 * New templates that don't match fall back to a monogram + neutral "App" category — nothing breaks.
 */

export type TemplateCategory = 'image' | 'llm' | 'embed' | 'notebook';
export type TemplateAccent = 'coral' | 'lime' | 'amber' | 'ink';

export interface TemplateVisual {
  cat: TemplateCategory;
  label: string;
  accent: TemplateAccent;
  mono: string;
}

/** Category → MUI icon. Rendered with `currentColor`, so it tints to the card accent. */
export const CATEGORY_ICON: Record<TemplateCategory, SvgIconComponent> = {
  image: ImageOutlined,
  llm: ChatBubbleOutline,
  embed: GrainOutlined,
  notebook: MenuBook,
};

/** Accent colours (light theme — the dashboard is light-only). `coral` / `lime` mirror --accent1 / --accent2. */
export const ACCENT_HEX: Record<TemplateAccent, string> = {
  coral: '#d54335',
  lime: '#4f9a10',
  amber: '#c96b00',
  ink: '#000000',
};

/** id-substring → visual. Extend as new templates ship; unknown ids fall back to a monogram. */
const VISUALS: Record<string, TemplateVisual> = {
  automatic1111: { cat: 'image', label: 'Image gen', accent: 'coral', mono: 'A1' },
  comfyui: { cat: 'image', label: 'Image gen', accent: 'coral', mono: 'CY' },
  fooocus: { cat: 'image', label: 'Image gen', accent: 'coral', mono: 'FO' },
  jupyterlab: { cat: 'notebook', label: 'Notebook', accent: 'ink', mono: 'JL' },
  llamacpp: { cat: 'llm', label: 'LLM', accent: 'lime', mono: 'LC' },
  'open-webui': { cat: 'llm', label: 'LLM chat', accent: 'lime', mono: 'OW' },
  vllm: { cat: 'llm', label: 'LLM serving', accent: 'lime', mono: 'vL' },
  // Longer than `vllm`, so a `vllm-nomic-embed` id resolves to Embeddings (see MATCH_KEYS sort).
  'nomic-embed': { cat: 'embed', label: 'Embeddings', accent: 'amber', mono: 'NE' },
};

// Longest key first so the most specific substring wins (e.g. `nomic-embed` over `vllm`).
const MATCH_KEYS = Object.keys(VISUALS).sort((a, b) => b.length - a.length);

export function visualFor(id: string): TemplateVisual {
  const key = MATCH_KEYS.find((k) => id.includes(k));
  if (key) {
    return VISUALS[key];
  }
  const mono = id.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
  return { cat: 'llm', label: 'App', accent: 'ink', mono: mono || '??' };
}

export interface TemplateHardware {
  /** True when the template declares a GPU resource — the main GPU-vs-CPU signal on the card. */
  gpu: boolean;
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
  return {
    gpu: reqs.some((r) => r.type === 'gpu' || r.id === 'gpu'),
    ram: amount('ram'),
    disk: amount('disk'),
  };
}
