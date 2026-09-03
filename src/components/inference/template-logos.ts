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
 * Keys match by substring against the template id, so one `comfyui` entry covers `comfyui`,
 * `comfyui-sdxl` and whatever ComfyUI variant a node publishes next, without listing each.
 *
 * A bundle's id usually names BOTH the app that runs it and the model inside it (`hermes-qwen38`,
 * `qwen38-opencode`), so the tiers below decide which one the tile wears. The model wins — a bundle is
 * bought for the model, and it is what a returning user scans the grid for — EXCEPT where the app is
 * itself the whole product rather than a runner for someone else's weights, which is what SHELL_KEYS
 * is for: a ComfyUI bundle is a ComfyUI bundle regardless of which checkpoints it ships.
 *
 * Suggested filenames for templates whose marks have NOT landed yet, so they stay consistent when they
 * do: `stable-diffusion`/`sd-webui`/`automatic1111` → stability-ai.svg, `fooocus` → fooocus.svg,
 * `wan-video` → wan.svg, `ltx-video` → lightricks.svg, `llamacpp` → llama-cpp.svg, `ollama` →
 * ollama.svg, `minimax` → minimax.svg, `glm`/`zai` → zhipu.svg.
 *
 * One trap worth knowing before adding a mark: these load as `<img src>`, so `currentColor` does not
 * reach them (a fill-less path renders black, invisible on a dark card) and an SVG's own
 * `@media (prefers-color-scheme: dark)` never fires — this app themes via a `data-theme` attribute, not
 * the OS preference. The tile's backplate is the same 12%-alpha accent tint in BOTH themes, so a mark
 * needs one treatment that works on both; a mark with open negative space (qwen) needs its own plate,
 * or the tint shows through the gaps and reads as a shape of its own.
 */
const TEMPLATE_LOGO_FILES: Record<string, string> = {
  comfyui: 'comfyui.svg',
  deepseek: 'deepseek.svg',
  hermes: 'hermes.svg',
  jupyter: 'jupyter.svg',
  glm: 'zai.svg',
  'nomic-embed': 'nomic.svg',
  openclaw: 'openclaw.svg',
  opencode: 'opencode.svg',
  'open-webui': 'open-webui.png',
  qwen: 'qwen.svg',
  vllm: 'vllm.png',
  // GLM is published by Z.ai, so both keys point at the same mark — `glm` catches the model as it is
  // named in ids (`glm52-opencode`), `zai` the vendor, should a template be keyed that way instead.
  zai: 'zai.svg',
};

/**
 * Apps whose own mark outranks the model's, because the app IS the product rather than a runner for
 * whatever weights it was pointed at — a ComfyUI bundle reads as ComfyUI first, and its manifest of
 * thirteen checkpoints is not a brand. Everything not listed here loses to a model key.
 */
const SHELL_KEYS = ['comfyui', 'jupyter', 'open-webui'];

/** Model marks, which outrank any app not in SHELL_KEYS (`qwen38-opencode` wears Qwen's mark). */
const MODEL_KEYS = ['deepseek', 'glm', 'qwen', 'zai', 'nomic-embed'];

// Three tiers, each longest-key-first so the most specific match inside a tier still wins (e.g.
// `nomic-embed` over `vllm` for `vllm-nomic-embed`). Ties inside a tier cannot happen today.
const byLengthDesc = (a: string, b: string) => b.length - a.length;
const ALL_KEYS = Object.keys(TEMPLATE_LOGO_FILES);
const MATCH_KEYS = [
  ...SHELL_KEYS.filter((k) => k in TEMPLATE_LOGO_FILES).sort(byLengthDesc),
  ...MODEL_KEYS.filter((k) => k in TEMPLATE_LOGO_FILES).sort(byLengthDesc),
  ...ALL_KEYS.filter((k) => !SHELL_KEYS.includes(k) && !MODEL_KEYS.includes(k)).sort(byLengthDesc),
];


/** Public path of a template's brand mark, or null when no file has been supplied for it. */
export function templateLogoSrc(templateId: string): string | null {
  const key = MATCH_KEYS.find((part) => templateId.includes(part));
  return key ? `/logos/templates/${TEMPLATE_LOGO_FILES[key]}` : null;
}

/**
 * Public path of a mark for a display NAME rather than an id — for places that only have the app's
 * name to go on (e.g. a table cell naming a template-launched service). Slugified the same way ids
 * are written, so "Open WebUI" reaches the `open-webui` entry and "vLLM" the `vllm` one.
 */
export function templateLogoForName(name: string): string | null {
  return templateLogoSrc(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
}

/**
 * A template's mark, falling back to its parent service's. A bundle runs the parent's image under its
 * own id (`comfyui-sdxl` on `comfyui`), so it wears the same brand — and the substring match usually
 * resolves it directly; the parent lookup covers ids that don't contain the parent's own id.
 */
export function templateLogo(template: AppTemplate): string | null {
  return templateLogoSrc(template.id) ?? (template.service ? templateLogoSrc(template.service) : null);
}
