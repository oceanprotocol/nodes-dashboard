/**
 * Which weight files each ComfyUI-servable model downloads, per variant.
 *
 * Keyed by the UPSTREAM Hugging Face id, because that is what the model picker shows. The files
 * themselves usually come from a Comfy-Org repack instead, and one model can span several repos:
 * LTX 2.3 pulls its backbone from Lightricks, its text encoder from Comfy-Org/ltx-2 and its
 * distilled LoRA from Comfy-Org/ltx-2.3. That is why a file is a full URL and not a repo plus a
 * path.
 *
 * `directory` is stated rather than derived. Comfy-Org repacks mirror ComfyUI's own models/ tree
 * so a path-segment guess would work for them, but Lightricks keeps weights at the repo root,
 * where the same guess files a 29 GB backbone under checkpoints/.
 *
 * A model absent from this table cannot be launched — the picker badges it "Not available yet".
 * Verify the table with `yarn check:presets` after editing.
 */

export type ComfyFile = {
  url: string;
  /** models/ subdirectory: diffusion_models, text_encoders, vae, loras, latent_upscale_models. */
  directory: string;
  gb: number;
};

export type ComfyPreset = {
  id: 'quality' | 'balanced' | 'lowvram';
  label: string;
  files: ComfyFile[];
  /** Sum of files[].gb. Drives the disk check at Config, before escrow is claimed. */
  totalGb: number;
  /** Largest single file, rounded up to the next 4 GB, plus 8 GB headroom. */
  minVramGb: number;
};

export type ComfyModelEntry = {
  presets: ComfyPreset[];
};

const MINIMAX = 'https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main';
const LTX_FP8 = 'https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main';
const LTX_FULL = 'https://huggingface.co/Lightricks/LTX-2.3/resolve/main';
const LTX2 = 'https://huggingface.co/Comfy-Org/ltx-2/resolve/main/split_files';
const LTX23 = 'https://huggingface.co/Comfy-Org/ltx-2.3/resolve/main/split_files';
const WAN = 'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files';
const KREA = 'https://huggingface.co/Comfy-Org/Krea-2/resolve/main';
const QWEN = 'https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files';

export const COMFY_MODEL_PRESETS: Record<string, ComfyModelEntry> = {
  'MiniMaxAI/MiniMax-H3': {
    presets: [
      {
        id: 'quality',
        label: 'Quality',
        totalGb: 97.5,
        minVramGb: 60,
        files: [
          { url: `${MINIMAX}/diffusion_models/minimax_h3_ref2va_pruned_bf16.safetensors`, directory: 'diffusion_models', gb: 40.2 },
          { url: `${MINIMAX}/text_encoders/qwen3vl_32b_minimax_h3_bf16.safetensors`, directory: 'text_encoders', gb: 51.5 },
          { url: `${MINIMAX}/vae/minimax_h3_video_vae_fp16.safetensors`, directory: 'vae', gb: 5.2 },
          { url: `${MINIMAX}/vae/minimax_h3_audio_vae_fp32.safetensors`, directory: 'vae', gb: 0.6 },
        ],
      },
      {
        id: 'balanced',
        label: 'Balanced',
        totalGb: 53.9,
        minVramGb: 36,
        files: [
          { url: `${MINIMAX}/diffusion_models/minimax_h3_ref2va_pruned_fp8_scaled.safetensors`, directory: 'diffusion_models', gb: 21.0 },
          { url: `${MINIMAX}/text_encoders/qwen3vl_32b_minimax_h3_int8_convrot.safetensors`, directory: 'text_encoders', gb: 27.1 },
          { url: `${MINIMAX}/vae/minimax_h3_video_vae_fp16.safetensors`, directory: 'vae', gb: 5.2 },
          { url: `${MINIMAX}/vae/minimax_h3_audio_vae_fp32.safetensors`, directory: 'vae', gb: 0.6 },
        ],
      },
      {
        id: 'lowvram',
        label: 'Low VRAM',
        totalGb: 42.5,
        minVramGb: 32,
        files: [
          { url: `${MINIMAX}/diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors`, directory: 'diffusion_models', gb: 21.0 },
          { url: `${MINIMAX}/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`, directory: 'text_encoders', gb: 15.7 },
          { url: `${MINIMAX}/vae/minimax_h3_video_vae_fp16.safetensors`, directory: 'vae', gb: 5.2 },
          { url: `${MINIMAX}/vae/minimax_h3_audio_vae_fp32.safetensors`, directory: 'vae', gb: 0.6 },
        ],
      },
    ],
  },

  'Lightricks/LTX-2.3': {
    presets: [
      {
        id: 'quality',
        label: 'Quality',
        totalGb: 71.5,
        minVramGb: 56,
        files: [
          { url: `${LTX_FULL}/ltx-2.3-22b-dev.safetensors`, directory: 'diffusion_models', gb: 46.1 },
          { url: `${LTX2}/text_encoders/gemma_3_12B_it.safetensors`, directory: 'text_encoders', gb: 24.4 },
          { url: `${LTX_FULL}/ltx-2.3-spatial-upscaler-x2-1.1.safetensors`, directory: 'latent_upscale_models', gb: 1.0 },
        ],
      },
      {
        id: 'balanced',
        label: 'Balanced',
        totalGb: 46.0,
        minVramGb: 40,
        files: [
          { url: `${LTX_FP8}/ltx-2.3-22b-dev-fp8.safetensors`, directory: 'diffusion_models', gb: 29.1 },
          { url: `${LTX2}/text_encoders/gemma_3_12B_it_fp8_scaled.safetensors`, directory: 'text_encoders', gb: 13.2 },
          { url: `${LTX23}/loras/ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors`, directory: 'loras', gb: 2.7 },
          { url: `${LTX_FULL}/ltx-2.3-spatial-upscaler-x2-1.1.safetensors`, directory: 'latent_upscale_models', gb: 1.0 },
        ],
      },
      {
        id: 'lowvram',
        label: 'Low VRAM',
        totalGb: 39.9,
        minVramGb: 40,
        files: [
          { url: `${LTX_FP8}/ltx-2.3-22b-distilled-fp8.safetensors`, directory: 'diffusion_models', gb: 29.5 },
          { url: `${LTX2}/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors`, directory: 'text_encoders', gb: 9.4 },
          { url: `${LTX_FULL}/ltx-2.3-spatial-upscaler-x2-1.1.safetensors`, directory: 'latent_upscale_models', gb: 1.0 },
        ],
      },
    ],
  },

  'Wan-AI/Wan2.2-I2V-A14B-Diffusers': {
    presets: [
      {
        id: 'quality',
        label: 'Quality',
        totalGb: 68.9,
        minVramGb: 40,
        files: [
          { url: `${WAN}/diffusion_models/wan2.2_i2v_high_noise_14B_fp16.safetensors`, directory: 'diffusion_models', gb: 28.6 },
          { url: `${WAN}/diffusion_models/wan2.2_i2v_low_noise_14B_fp16.safetensors`, directory: 'diffusion_models', gb: 28.6 },
          { url: `${WAN}/text_encoders/umt5_xxl_fp16.safetensors`, directory: 'text_encoders', gb: 11.4 },
          { url: `${WAN}/vae/wan_2.1_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
      {
        id: 'balanced',
        label: 'Balanced',
        totalGb: 35.6,
        minVramGb: 24,
        files: [
          { url: `${WAN}/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors`, directory: 'diffusion_models', gb: 14.3 },
          { url: `${WAN}/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`, directory: 'diffusion_models', gb: 14.3 },
          { url: `${WAN}/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`, directory: 'text_encoders', gb: 6.7 },
          { url: `${WAN}/vae/wan_2.1_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
    ],
  },

  'krea/Krea-2-Turbo': {
    presets: [
      {
        id: 'quality',
        label: 'Quality',
        totalGb: 35.5,
        minVramGb: 36,
        files: [
          { url: `${KREA}/diffusion_models/krea2_turbo_bf16.safetensors`, directory: 'diffusion_models', gb: 26.3 },
          { url: `${KREA}/text_encoders/qwen3vl_4b_bf16.safetensors`, directory: 'text_encoders', gb: 8.9 },
          { url: `${KREA}/vae/qwen_image_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
      {
        id: 'balanced',
        label: 'Balanced',
        totalGb: 18.6,
        minVramGb: 24,
        files: [
          { url: `${KREA}/diffusion_models/krea2_turbo_fp8_scaled.safetensors`, directory: 'diffusion_models', gb: 13.1 },
          { url: `${KREA}/text_encoders/qwen3vl_4b_fp8_scaled.safetensors`, directory: 'text_encoders', gb: 5.2 },
          { url: `${KREA}/vae/qwen_image_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
      {
        id: 'lowvram',
        label: 'Low VRAM',
        totalGb: 13.2,
        minVramGb: 16,
        files: [
          { url: `${KREA}/diffusion_models/krea2_turbo_nvfp4.safetensors`, directory: 'diffusion_models', gb: 7.7 },
          { url: `${KREA}/text_encoders/qwen3vl_4b_fp8_scaled.safetensors`, directory: 'text_encoders', gb: 5.2 },
          { url: `${KREA}/vae/qwen_image_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
    ],
  },

  'Qwen/Qwen-Image': {
    presets: [
      {
        id: 'quality',
        label: 'Quality',
        totalGb: 57.8,
        minVramGb: 52,
        files: [
          { url: `${QWEN}/diffusion_models/qwen_image_2512_bf16.safetensors`, directory: 'diffusion_models', gb: 40.9 },
          { url: `${QWEN}/text_encoders/qwen_2.5_vl_7b.safetensors`, directory: 'text_encoders', gb: 16.6 },
          { url: `${QWEN}/vae/qwen_image_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
      {
        id: 'balanced',
        label: 'Balanced',
        totalGb: 30.1,
        minVramGb: 32,
        files: [
          { url: `${QWEN}/diffusion_models/qwen_image_2512_fp8_e4m3fn.safetensors`, directory: 'diffusion_models', gb: 20.4 },
          { url: `${QWEN}/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors`, directory: 'text_encoders', gb: 9.4 },
          { url: `${QWEN}/vae/qwen_image_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
      {
        id: 'lowvram',
        label: 'Low VRAM',
        totalGb: 26.2,
        minVramGb: 28,
        files: [
          { url: `${QWEN}/diffusion_models/qwen_image_nvfp4.safetensors`, directory: 'diffusion_models', gb: 19.8 },
          { url: `${QWEN}/text_encoders/qwen_2.5_vl_7b_nvfp4.safetensors`, directory: 'text_encoders', gb: 6.1 },
          { url: `${QWEN}/vae/qwen_image_vae.safetensors`, directory: 'vae', gb: 0.25 },
        ],
      },
    ],
  },
};

/** Presets for a model, or [] when it is not curated — the picker badges those "Not available yet". */
export function getComfyPresets(modelId: string): ComfyPreset[] {
  return COMFY_MODEL_PRESETS[modelId]?.presets ?? [];
}

/** The COMFY_MODEL_FILES payload: one "<directory>\t<url>" line per file. */
export function comfyModelFilesEnv(preset: ComfyPreset): string {
  return preset.files.map((f) => `${f.directory}\t${f.url}`).join('\n');
}
