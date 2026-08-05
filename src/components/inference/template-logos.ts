import { AppTemplate } from '@/types/templates';

/**
 * Brand marks for app templates. These are third-party trademarks, so they ship as real asset files
 * rather than being redrawn as icons: drop the file into `public/logos/templates/` and add its
 * filename here, keyed by a distinctive part of the template id. SVG when the project publishes one,
 * PNG at 96px when it doesn't — the tile renders it at 22px either way.
 *
 * This map is the manifest of files that are ACTUALLY PRESENT — a template renders an <img> only when
 * it matches an entry, so a mark that hasn't been supplied is never requested (no 404, no broken tile).
 * An unmatched template keeps its category glyph, and an uncategorised one falls back to a monogram.
 *
 * Keys match by substring against the template id (longest key first), the same way categories are
 * resolved in template-visual — so one `comfyui` entry covers `comfyui`, `comfyui-sdxl` and whatever
 * ComfyUI variant a node publishes next, without listing each.
 *
 * Suggested filenames for the templates the node publishes today, so they stay consistent as the marks
 * land: `stable-diffusion`/`sd-webui`/`automatic1111` → stability-ai.svg, `comfyui` → comfyui.svg,
 * `fooocus` → fooocus.svg, `wan-video` → wan.svg, `ltx-video` → lightricks.svg, `jupyter` →
 * jupyter.svg, `llamacpp` → llama-cpp.svg, `open-webui` → open-webui.svg, `ollama` → ollama.svg,
 * `vllm` → vllm.svg, `nomic-embed` → nomic.svg.
 */
const TEMPLATE_LOGO_FILES: Record<string, string> = {
  comfyui: 'comfyui.svg',
  jupyter: 'jupyter.svg',
  // Longer than `vllm`, so `vllm-nomic-embed` wears Nomic's mark rather than vLLM's (see MATCH_KEYS).
  'nomic-embed': 'nomic.svg',
  vllm: 'vllm.png',
  // PNG, not SVG: Open WebUI publishes no vector mark — its own favicon.svg is a 500px PNG in an SVG
  // wrapper, so this is that same artwork at the size the tile actually needs (96px, transparent).
  'open-webui': 'open-webui.png',
};

// Longest key first so the most specific match wins (e.g. `open-webui` over a hypothetical `webui`).
const MATCH_KEYS = Object.keys(TEMPLATE_LOGO_FILES).sort((a, b) => b.length - a.length);

/** Public path of a template's brand mark, or null when no file has been supplied for it. */
export function templateLogoSrc(templateId: string): string | null {
  const key = MATCH_KEYS.find((part) => templateId.includes(part));
  return key ? `/logos/templates/${TEMPLATE_LOGO_FILES[key]}` : null;
}

/**
 * A template's mark, falling back to its parent service's. A bundle runs the parent's image under its
 * own id (`comfyui-sdxl` on `comfyui`), so it wears the same brand — and the substring match usually
 * resolves it directly; the parent lookup covers ids that don't contain the parent's own id.
 */
export function templateLogo(template: AppTemplate): string | null {
  return templateLogoSrc(template.id) ?? (template.service ? templateLogoSrc(template.service) : null);
}
