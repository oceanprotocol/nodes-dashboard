import { AppTemplate } from '@/types/templates';

/**
 * Local stand-in for bundles a node hasn't been updated to publish yet.
 *
 * MOCK DATA, on by default (opt out with `NEXT_PUBLIC_MOCK_BUNDLES=0`): `fetchTemplates` merges these
 * into whatever the node returns, so the bundles catalogue works end to end — on Vercel too — before
 * `ocean-node` ships the `kind`/`service`/`outcome`/`category`/`includes` fields. Delete this file
 * (and the merge in `services/service-templates.ts`) once the node serves them for real.
 *
 * These are NOT invented: every entry mirrors a template that already exists in
 * `ocean-node/docs/serviceTemplates/` — same image, tag, ports, command and resources — with only the
 * classification fields added. So a launch from a mocked bundle is a real launch: `SERVICE_START`
 * carries the image and command directly and the node needs no template of its own to honour it.
 */

/** Shared by every ComfyUI entry: same image, same optional token vars. */
const COMFYUI_IMAGE = { image: 'yanwk/comfyui-boot', tag: 'cu126-megapak' } as const;

const COMFYUI_TOKENS = [
  { key: 'HF_TOKEN', validation: '^hf_[A-Za-z0-9]{20,}$', sensitive: true },
  { key: 'CIVITAI_TOKEN', validation: '^[A-Za-z0-9]{20,}$', sensitive: true },
];

/**
 * The provisioning script both ComfyUI bundles run, byte-for-byte as in the node's template JSON:
 * create the model dirs, then download in a BACKGROUND subshell so the UI is up in seconds while the
 * weights land, then hand over to the image's own entrypoint. `fetch` prints the `[models]` markers
 * the manage page's progress panel reads.
 *
 * The aria2c flags are deliberate: Hugging Face redirects to a Xet CDN URL whose signature covers one
 * `ByteRange`, so aria2c's tail-end re-splitting asks for a range the URL wasn't signed for and gets a
 * `403` per connection. `-k1G` stops it splitting below 1 GB (where that happens) and the retry flags
 * recover a rejected range instead of dropping the connection. Keep in sync with the node's JSON.
 */
function comfyuiCommand(downloads: { url: string; dest: string }[]): string[] {
  const fetches = downloads.map((d) => `  fetch ${d.url} "$M/${d.dest}"`).join('\n');
  return [
    `M=/root/ComfyUI/models
mkdir -p "$M/checkpoints" "$M/vae"
fetch() {
  out="$2"; name=$(basename "$out")
  if [ -s "$out" ]; then echo "[models] already present: $name"; return 0; fi
  echo "[models] downloading $name"
  if aria2c -x4 -s4 -k1024M --max-tries=5 --retry-wait=5 --continue=true --auto-file-renaming=false --allow-overwrite=true --summary-interval=30 -d "$(dirname "$out")" -o "$name" "$1"; then echo "[models] ready: $name"; return 0; fi
  echo "[models] aria2c failed for $name, falling back to wget"
  if wget -q -c -O "$out" "$1"; then echo "[models] ready: $name"; return 0; fi
  echo "[models] WARNING: could not download $name — install it from ComfyUI-Manager instead"
  rm -f "$out"
  return 0
}
(
${fetches}
  echo "[models] bundle complete — refresh the ComfyUI tab to see the checkpoints"
) &
exec bash /runner-scripts/entrypoint.sh`,
  ];
}

export const MOCK_BUNDLES: AppTemplate[] = [
  // The parent service. Included so the bundles page has a real section name and a working
  // "Start it empty" link even against a node that publishes no templates at all. If the node does
  // publish `comfyui`, this entry replaces it (see mergeMockBundles) — same image either way.
  {
    id: 'comfyui',
    kind: 'service',
    category: 'image',
    name: 'ComfyUI — image & video generation',
    description:
      'Node-graph web UI for diffusion models (Stable Diffusion / SDXL / Flux, video via AnimateDiff/SVD). Bundles ComfyUI-Manager so checkpoints and custom nodes install from the UI at runtime. No models ship in the image.',
    ...COMFYUI_IMAGE,
    exposedPorts: [8188],
    userConfigurableEnvVars: COMFYUI_TOKENS,
    requiredResources: [
      { id: 'cpu', min: 4, recommended: 8, unit: 'cores' },
      { id: 'ram', min: 16, recommended: 32, unit: 'GB' },
      { id: 'disk', min: 30, recommended: 60, unit: 'GB' },
      { kind: 'discrete', type: 'gpu', min: 1, recommended: 1, unit: 'count' },
    ],
  },
  {
    id: 'comfyui-sdxl',
    kind: 'bundle',
    service: 'comfyui',
    category: 'image',
    outcome: 'Generate images from a text prompt',
    name: 'ComfyUI + SDXL — image generation, models included',
    description:
      "Same ComfyUI, with the weights bundled in so you can generate on first launch without hunting for a checkpoint. The UI comes up on port 8188 within seconds while the models download in the background — refresh the browser once they land and they appear in the Load Checkpoint dropdown.",
    ...COMFYUI_IMAGE,
    exposedPorts: [8188],
    entrypoint: ['/bin/bash', '-c'],
    command: comfyuiCommand([
      {
        url: 'https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors',
        dest: 'checkpoints/v1-5-pruned-emaonly.safetensors',
      },
      {
        url: 'https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors',
        dest: 'vae/sdxl_vae.safetensors',
      },
      {
        url: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors',
        dest: 'checkpoints/sd_xl_base_1.0.safetensors',
      },
    ]),
    includes: [
      {
        name: 'SDXL Base 1.0',
        kind: 'model',
        sizeGb: 6.9,
        repoId: 'stabilityai/stable-diffusion-xl-base-1.0',
      },
      {
        name: 'Stable Diffusion 1.5',
        kind: 'model',
        sizeGb: 4.3,
        repoId: 'stable-diffusion-v1-5/stable-diffusion-v1-5',
      },
      { name: 'SDXL VAE fp16-fix', kind: 'model', sizeGb: 0.3, repoId: 'madebyollin/sdxl-vae-fp16-fix' },
    ],
    userConfigurableEnvVars: COMFYUI_TOKENS,
    requiredResources: [
      { id: 'cpu', min: 4, recommended: 8, unit: 'cores' },
      { id: 'ram', min: 16, recommended: 32, unit: 'GB' },
      {
        id: 'disk',
        min: 50,
        recommended: 90,
        unit: 'GB',
        description: '~25 GB image + ~11.5 GB bundled weights + room for outputs and extra models',
      },
      {
        kind: 'discrete',
        type: 'gpu',
        min: 1,
        recommended: 1,
        unit: 'count',
        description: 'CUDA GPU; ~10 GB VRAM for SDXL at 1024x1024',
      },
    ],
  },
  {
    id: 'comfyui-flux-schnell',
    kind: 'bundle',
    service: 'comfyui',
    category: 'image',
    outcome: 'Generate images from a text prompt in a few steps',
    name: 'ComfyUI + FLUX.1 schnell — fast image generation, model included',
    description:
      "Bundled with FLUX.1 schnell in Comfy Org's fp8 single-file build (weights + CLIP-L + T5-XXL + VAE in one checkpoint, so a plain Load Checkpoint node is all you need). schnell is the 4-step distilled Flux variant — Apache-2.0 and ungated.",
    ...COMFYUI_IMAGE,
    exposedPorts: [8188],
    entrypoint: ['/bin/bash', '-c'],
    command: comfyuiCommand([
      {
        url: 'https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell-fp8.safetensors',
        dest: 'checkpoints/flux1-schnell-fp8.safetensors',
      },
    ]),
    includes: [
      { name: 'FLUX.1 schnell (fp8, all-in-one)', kind: 'model', sizeGb: 17.2, repoId: 'Comfy-Org/flux1-schnell' },
    ],
    userConfigurableEnvVars: COMFYUI_TOKENS,
    requiredResources: [
      { id: 'cpu', min: 4, recommended: 8, unit: 'cores' },
      { id: 'ram', min: 32, recommended: 48, unit: 'GB' },
      {
        id: 'disk',
        min: 60,
        recommended: 110,
        unit: 'GB',
        description: '~25 GB image + 17.2 GB bundled checkpoint + room for outputs',
      },
      {
        kind: 'discrete',
        type: 'gpu',
        min: 1,
        recommended: 1,
        unit: 'count',
        description: 'CUDA GPU; ~16 GB VRAM recommended (12 GB works with weight offloading)',
      },
    ],
  },
];

/**
 * Whether the mock catalogue is switched on.
 *
 * **On by default everywhere, including production builds** — no node publishes bundle-kind templates
 * yet, so without the mock the Templates page is empty on every deployment. Turn it off with
 * `NEXT_PUBLIC_MOCK_BUNDLES=0` once the node serves the real catalogue, and flip this default back at
 * that point.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so changing this needs a rebuild (dev-server
 * restart locally, redeploy on Vercel).
 */
export const MOCK_BUNDLES_ENABLED = process.env.NEXT_PUBLIC_MOCK_BUNDLES !== '0';

/**
 * Overlay the mocks onto the node's catalogue: an entry with the same id is replaced (so a node that
 * already serves `comfyui-sdxl` without the classification fields still shows up as a bundle), and
 * anything else the node publishes is kept untouched. No-op when the flag is off.
 */
export function mergeMockBundles(templates: AppTemplate[]): AppTemplate[] {
  if (!MOCK_BUNDLES_ENABLED) {
    return templates;
  }
  const mockedIds = new Set(MOCK_BUNDLES.map((t) => t.id));
  const merged = [...templates.filter((t) => !mockedIds.has(t.id)), ...MOCK_BUNDLES];
  // Say it out loud: a catalogue containing entries the node never published is confusing to debug
  // otherwise ("why is comfyui-sdxl there when the node doesn't serve it?").
  console.info(
    `[mock] bundle catalogue is ON — ${MOCK_BUNDLES.length} mock entries merged over ${templates.length} from the node. ` +
      'Set NEXT_PUBLIC_MOCK_BUNDLES=0 to turn it off.'
  );
  return merged;
}
