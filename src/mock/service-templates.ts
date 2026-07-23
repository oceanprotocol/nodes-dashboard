import { AppTemplate } from '@/types/templates';

/**
 * Curated app templates for the Templates flow. MOCK DATA — mirrors the quick-start packages seam
 * (`src/mock/inference-packages.ts`): swap `fetchServiceTemplates` for ocean.js `getServiceTemplates`
 * (BaseProvider.getServiceTemplates → ServiceTemplatePublic[]) once the node catalog is queried per
 * service-capable env. An AppTemplate is a superset of ServiceTemplatePublic, so fetched templates drop
 * straight in (fixedEnvVars/presentation just absent).
 *
 * These are LAUNCH PRESETS: they fill ServiceStartParams (image/tag/exposedPorts/command/userData/resources).
 * Any service-capable environment can run them — the env does not need to advertise the template.
 */
const TEMPLATES: AppTemplate[] = [
  {
    id: 'comfyui',
    name: 'ComfyUI — image & video generation',
    description:
      'Node-graph web UI for diffusion models (Stable Diffusion / SDXL / Flux, video via AnimateDiff/SVD). ' +
      'Launches on a CUDA GPU and serves the ComfyUI canvas on port 8188 — open the returned URL in a browser. ' +
      'Bundles ComfyUI-Manager so checkpoints and custom nodes install from the UI at runtime; supply HF_TOKEN / ' +
      'CIVITAI_TOKEN for gated downloads. No models ship in the image. Needs ~10 GB VRAM for SDXL.',
    // No vendor-official ComfyUI image (unlike vllm/vllm-openai). Community image; pin by `checksum` for prod.
    // NOTE: yanwk/comfyui-boot has NO `latest` tag — tags are variant-based (cu126-slim, cu130-slim,
    // cu126-megapak, cpu, rocm, …). `cu126-megapak` bundles ComfyUI-Manager (needed for in-UI model installs).
    // The node's GPU driver must support the tag's CUDA version; on an older driver use an older cu tag.
    image: 'yanwk/comfyui-boot',
    tag: 'cu126-megapak',
    exposedPorts: [8188],
    primaryPort: 8188,
    category: 'image-gen',
    icon: 'image',
    // The image's boot script reads CLI_ARGS from env; --listen 0.0.0.0 is mandatory or the port-forward is
    // unreachable. Operator-fixed → fixedEnvVars (not user-editable), merged into userData at launch.
    fixedEnvVars: {
      CLI_ARGS: '--listen 0.0.0.0 --port 8188',
    },
    userConfigurableEnvVars: [
      { key: 'HF_TOKEN', validation: '^hf_[A-Za-z0-9]{20,}$', sensitive: true },
      { key: 'CIVITAI_TOKEN', validation: '^[A-Za-z0-9]{20,}$', sensitive: true },
    ],
    requiredResources: [
      { id: 'cpu', min: 4, recommended: 8, unit: 'cores' },
      { id: 'ram', min: 16, recommended: 32, unit: 'GB' },
      { id: 'disk', min: 30, recommended: 60, unit: 'GB' },
      {
        kind: 'discrete',
        type: 'gpu',
        min: 1,
        recommended: 1,
        unit: 'count',
        description: 'CUDA GPU; ~10 GB VRAM for SDXL, more for Flux/video',
      },
    ],
  },
  {
    id: 'automatic1111',
    name: 'Stable Diffusion WebUI (A1111) — image generation',
    description:
      'The classic AUTOMATIC1111 web UI for Stable Diffusion / SDXL: txt2img, img2img, inpainting, upscaling, ' +
      'extensions and a built-in model browser. Launches on a CUDA GPU and serves on port 7860 — open the returned ' +
      'URL in a browser. No models ship in the image; download checkpoints from the UI or supply HF_TOKEN / ' +
      'CIVITAI_TOKEN for gated downloads. Needs ~8 GB VRAM for SDXL.',
    // No vendor-official A1111 image (upstream ships only source + webui.sh). Community image; pin by `checksum`
    // for prod and verify the tag exists before relying on it. `universonic/stable-diffusion-webui` bundles the
    // webui with a CUDA runtime and reads launch flags from COMMANDLINE_ARGS (below).
    image: 'universonic/stable-diffusion-webui',
    tag: 'latest',
    exposedPorts: [7860],
    primaryPort: 7860,
    category: 'image-gen',
    icon: 'image',
    // webui.sh reads COMMANDLINE_ARGS from env; --listen is mandatory or the port-forward is unreachable.
    // Operator-fixed → fixedEnvVars (not user-editable), merged into userData at launch.
    fixedEnvVars: {
      COMMANDLINE_ARGS: '--listen --port 7860 --enable-insecure-extension-access',
    },
    userConfigurableEnvVars: [
      { key: 'HF_TOKEN', validation: '^hf_[A-Za-z0-9]{20,}$', sensitive: true },
      { key: 'CIVITAI_TOKEN', validation: '^[A-Za-z0-9]{20,}$', sensitive: true },
    ],
    requiredResources: [
      { id: 'cpu', min: 4, recommended: 8, unit: 'cores' },
      { id: 'ram', min: 16, recommended: 32, unit: 'GB' },
      { id: 'disk', min: 30, recommended: 60, unit: 'GB' },
      {
        kind: 'discrete',
        type: 'gpu',
        min: 1,
        recommended: 1,
        unit: 'count',
        description: 'CUDA GPU; ~8 GB VRAM for SDXL, more for large models',
      },
    ],
  },
  {
    id: 'fooocus',
    name: 'Fooocus — simplified SDXL image generation',
    description:
      'Streamlined SDXL image generator (Midjourney-style): minimal settings, quality-focused defaults, no prompt ' +
      'engineering required. Launches on a CUDA GPU and serves on port 7865 — open the returned URL in a browser. ' +
      'Downloads its base SDXL checkpoint on first run, so first launch is slow. Needs ~8 GB VRAM.',
    // No vendor-official image published to a registry (upstream ships a Dockerfile only). Community image; pin by
    // `checksum` for prod and verify the tag before relying on it. Fooocus reads launch flags from CMDARGS.
    image: 'ghcr.io/lllyasviel/fooocus',
    tag: 'latest',
    exposedPorts: [7865],
    primaryPort: 7865,
    category: 'image-gen',
    icon: 'image',
    // Fooocus entry reads CMDARGS from env; --listen binds 0.0.0.0 or the port-forward is unreachable.
    fixedEnvVars: {
      CMDARGS: '--listen --port 7865',
    },
    requiredResources: [
      { id: 'cpu', min: 4, recommended: 8, unit: 'cores' },
      { id: 'ram', min: 16, recommended: 32, unit: 'GB' },
      { id: 'disk', min: 30, recommended: 60, unit: 'GB' },
      {
        kind: 'discrete',
        type: 'gpu',
        min: 1,
        recommended: 1,
        unit: 'count',
        description: 'CUDA GPU; ~8 GB VRAM for SDXL',
      },
    ],
  },
  {
    id: 'jupyterlab',
    name: 'JupyterLab — notebooks & data science',
    description:
      'JupyterLab web IDE (notebooks, terminal, file browser) on the scipy stack (numpy/pandas/scikit-learn/' +
      'matplotlib preinstalled). CPU-only by default — good for data exploration, prototyping, teaching. Serves on ' +
      'port 8888; token auth is disabled so the forwarded URL opens straight into the workspace. ' +
      'NOTE: the endpoint is an unauthenticated port-forward — anyone with the URL has full notebook (code-exec) access.',
    // Jupyter Docker Stacks moved to quay.io; the docker.io/jupyter/* mirror is frozen. Use the current registry.
    image: 'quay.io/jupyter/scipy-notebook',
    // Published as dated tags (e.g. 2024-01-15) + `latest`. Pin a date for prod reproducibility.
    tag: 'latest',
    exposedPorts: [8888],
    primaryPort: 8888,
    category: 'notebook',
    icon: 'code',
    // Kill token auth + bind all interfaces, else the port-forward lands on a login wall it can't satisfy.
    // These are launch flags, not env — carried in `command` (start-notebook.sh is the image entrypoint script).
    command: [
      'start-notebook.sh',
      '--NotebookApp.token=',
      '--NotebookApp.password=',
      '--NotebookApp.ip=0.0.0.0',
      '--NotebookApp.allow_origin=*',
    ],
    requiredResources: [
      { id: 'cpu', min: 2, recommended: 4, unit: 'cores' },
      { id: 'ram', min: 4, recommended: 8, unit: 'GB' },
      { id: 'disk', min: 10, recommended: 20, unit: 'GB' },
    ],
  },
  {
    id: 'open-webui',
    name: 'Open WebUI — chat UI + local LLMs (Ollama)',
    description:
      'ChatGPT-style web UI wired to a bundled Ollama runtime (the `:ollama` image ships Ollama in-container), so it ' +
      'runs local LLMs out of the box — pull a model (e.g. llama3.1:8b, mistral) from the model dropdown. Serves on ' +
      'port 8080. First visit prompts you to create an admin account. Needs a CUDA GPU for usable token speed. ' +
      'NOTE: standalone Open WebUI is only a frontend — the `:ollama` tag is what makes it self-contained.',
    image: 'ghcr.io/open-webui/open-webui',
    tag: 'ollama',
    exposedPorts: [8080],
    primaryPort: 8080,
    category: 'llm-ui',
    icon: 'chat',
    // Binds 0.0.0.0:8080 by default; no launch flags needed.
    requiredResources: [
      { id: 'cpu', min: 4, recommended: 8, unit: 'cores' },
      { id: 'ram', min: 8, recommended: 16, unit: 'GB' },
      { id: 'disk', min: 20, recommended: 40, unit: 'GB' },
      {
        kind: 'discrete',
        type: 'gpu',
        min: 1,
        recommended: 1,
        unit: 'count',
        description: 'CUDA GPU for local LLM inference',
      },
    ],
  },
];

const MOCK_FETCH_DELAY_MS = 300;

/** Mimics the eventual template-catalog API: resolves the curated list after a short delay. */
export async function fetchServiceTemplates(): Promise<AppTemplate[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_FETCH_DELAY_MS));
  return TEMPLATES;
}

/** Look up one template by id (the `[templateId]` route param / URL hydration). */
export async function fetchServiceTemplate(id: string): Promise<AppTemplate | null> {
  const all = await fetchServiceTemplates();
  return all.find((t) => t.id === id) ?? null;
}

/**
 * Match a running service back to the template it was launched from, by container image. Used by the
 * services table / manage page to recognise a template service (so Edit re-enters the template flow,
 * not the model flow) — the node returns only image/command, no template id. Tag is ignored on purpose:
 * serviceRestart can't change the image anyway, so image alone identifies the app.
 */
export async function matchTemplateByImage(image: string | undefined): Promise<AppTemplate | null> {
  if (!image) {
    return null;
  }
  const all = await fetchServiceTemplates();
  return all.find((t) => t.image === image) ?? null;
}
