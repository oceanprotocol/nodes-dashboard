# Template brand marks

Marks for the app templates the node publishes, rendered in the 38px accent tile on the catalogue
cards and in the details modal at 22px. A file here does nothing on its own — register it in
`src/components/inference/template-logos.ts`, keyed by a distinctive substring of the template id
(one `comfyui` entry covers `comfyui-sdxl`, `comfyui-flux-schnell`, …). Unregistered templates keep
their category glyph, so the map is the manifest of what is actually present: no 404s, no broken tiles.

These are **third-party trademarks**, included to identify each app in the catalogue. They are not
Ocean assets and are not covered by this repo's licence.

| File | Template ids | Source | Changes |
| --- | --- | --- | --- |
| `comfyui.svg` | `comfyui*` | <https://www.comfy.org/favicon.svg> | 10px corner radius on the backplate. The plate stays — the glyph is neon yellow and disappears on the light tile without it |
| `jupyter.svg` | `jupyter*` | jupyter/design, `logos/Logo Mark/logomark-orangebody-whitemoons/` | None |
| `nomic.svg` | `*nomic-embed*` | <https://www.nomic.ai/favicon.svg> | None |
| `open-webui.png` | `open-webui*` | open-webui/open-webui, `static/static/favicon-96x96.png` | None (the project ships no vector — its `favicon.svg` is a PNG in an SVG wrapper) |
| `vllm.png` | `vllm*` | vllm-project/vllm, `docs/assets/logos/vllm-logo-only-light.png` | Downscaled 1203px → 96px |

Prefer an SVG when the project publishes one; otherwise a 96px transparent PNG, which is enough for
the 22px slot at 3× density.

No usable mark found for `automatic1111` / `sd-webui` (the project ships none), `fooocus` (none), or
`llamacpp` (its only media asset is a 1500×500 wordmark on a dark plate, unusable in a square tile).
Those keep their category glyph.
