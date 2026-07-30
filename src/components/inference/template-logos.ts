/**
 * Brand marks for app templates. These are third-party trademarks, so they ship as real asset files
 * rather than being redrawn as icons: drop the SVG into `public/logos/templates/` and add its filename
 * here, keyed by template id.
 *
 * This map is the manifest of files that are ACTUALLY PRESENT — a template renders an <img> only when
 * it is listed, so a mark that hasn't been supplied is never requested (no 404, no broken tile). An
 * unlisted template keeps its category glyph, and an uncategorised one falls back to a monogram.
 *
 * Suggested filenames for the templates the node publishes today, so they stay consistent as the marks
 * land: `stable-diffusion-webui` → stability-ai.svg, `comfyui-gpu` → comfyui.svg, `fooocus` →
 * fooocus.svg, `wan-video` → wan.svg, `ltx-video-studio` → lightricks.svg, `jupyterlab` → jupyter.svg,
 * `llamacpp-*` → llama-cpp.svg, `open-webui-ollama` → ollama.svg, `open-webui` → open-webui.svg,
 * `vllm-*` → vllm.svg, `vllm-hf*` → huggingface.svg, `vllm-nomic-embed` → nomic.svg.
 */
const TEMPLATE_LOGO_FILES: Record<string, string> = {};

/** Public path of a template's brand mark, or null when no file has been supplied for it. */
export function templateLogoSrc(templateId: string): string | null {
  const file = TEMPLATE_LOGO_FILES[templateId];
  return file ? `/logos/templates/${file}` : null;
}
