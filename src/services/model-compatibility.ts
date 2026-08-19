import { HuggingFaceModel } from '@/types/huggingface';

/**
 * Whether a Hugging Face model can be served by the text-inference engines this dashboard launches
 * (vLLM, llama.cpp). Both are OpenAI-compatible *text* servers: they sample tokens from a causal LM.
 * A model that generates images, audio or video — or that only produces embeddings/labels — cannot be
 * served by either, no matter which engine the user picks.
 *
 * This is deliberately a LIST-LEVEL check: it reads only `pipelineTag` and `libraryName`, both of
 * which ship in the `/api/models` list response. So it can gate a whole grid without a per-model
 * `config.json` fetch. The finer per-model check (is this specific architecture in vLLM's registry?)
 * needs that fetch and belongs after selection — see fetchHuggingFaceModelConfig.
 */

/** Why a model isn't servable — drives the copy shown to the user. */
export type IncompatibilityKind =
  /** Generates images/audio/video. Needs a diffusion/media runtime, not a text engine. */
  | 'generative-media'
  /** Produces embeddings, scores or labels — no chat/completions endpoint to serve. */
  | 'non-generative'
  /** Not an inference-servable model at all (robotics policies, RL agents, tabular, graph). */
  | 'unsupported-task'
  /** Ships as a non-transformers library (diffusers, ComfyUI single-file) the text engines can't load. */
  | 'unsupported-library';

export type ModelCompatibility =
  | { supported: true; /** True when nothing identified the model either way — allow, but warn. */ unverified: boolean }
  | { supported: false; kind: IncompatibilityKind; reason: string };

/**
 * Pipeline tags the text engines CAN serve. Kept as an explicit allowlist rather than a
 * "not in the blocklist" rule: HF has ~52 pipeline tags and adds more, and a new tag is far more
 * likely to be another media/vision task than a new way to sample text — so an unknown tag should
 * fall through to "unverified", never to "supported".
 *
 * `text2text-generation` is legacy (HF folded it into text-generation) but older repos still carry it.
 * The `*-text-to-text` tags are multimodal INPUT with text output — vLLM serves those (vision/audio
 * understanding), which is why they belong here and `text-to-image` does not.
 */
export const SERVABLE_PIPELINE_TAGS = new Set([
  'text-generation',
  'text2text-generation',
  'image-text-to-text',
  'audio-text-to-text',
  'video-text-to-text',
  // Genuinely ambiguous: "any-to-any" models may or may not expose a text path. Treated as servable
  // because the omni models Ocean nodes actually run (Qwen-Omni and friends) do.
  'any-to-any',
]);

/**
 * Tags that generate non-text media. Split out from the other unsupported tags because the user
 * message differs: these have a real home (a prebuilt media service template), so the copy should
 * point there rather than just refusing.
 */
const GENERATIVE_MEDIA_TAGS = new Set([
  'text-to-image',
  'text-to-video',
  'text-to-audio',
  'text-to-speech',
  'text-to-3d',
  'image-to-image',
  'image-to-video',
  'image-to-3d',
  'image-text-to-image',
  'image-text-to-video',
  'video-to-video',
  'audio-to-audio',
  'unconditional-image-generation',
]);

/**
 * Tags that produce vectors/scores/labels instead of generated tokens. Servable in principle by a
 * dedicated embeddings runtime (TEI, Infinity) — and vLLM does implement some of these — but NOT by
 * the chat/completions flow this dashboard builds around, so they're blocked here.
 */
const NON_GENERATIVE_TAGS = new Set([
  'feature-extraction',
  'image-feature-extraction',
  'sentence-similarity',
  'text-ranking',
  'text-classification',
  'token-classification',
  'zero-shot-classification',
  'fill-mask',
  'audio-classification',
  'image-classification',
  'video-classification',
  'zero-shot-image-classification',
  'object-detection',
  'zero-shot-object-detection',
  'image-segmentation',
  'depth-estimation',
  'keypoint-detection',
  'mask-generation',
  'automatic-speech-recognition',
  'voice-activity-detection',
  'visual-document-retrieval',
  'image-to-text',
  // Extractive/structured QA and summarisation heads — encoder models with task-specific outputs,
  // not causal LMs. (A *chat* model that answers questions is tagged text-generation.)
  'question-answering',
  'document-question-answering',
  'visual-question-answering',
  'table-question-answering',
  'summarization',
  'translation',
]);

/** Libraries whose weights neither text engine can load, regardless of pipeline tag. */
const UNSUPPORTED_LIBRARIES = new Set([
  'diffusers',
  'diffusion-single-file',
  'sentence-transformers',
  'timm',
  'open_clip',
  'espnet',
  'nemo',
  'stable-baselines3',
  'ml-agents',
  'sample-factory',
  'fasttext',
  'sklearn',
]);

/**
 * Human phrase for a pipeline tag, article included: `text-to-audio` → "a text-to-audio", and
 * `automatic-speech-recognition` → "an automatic speech recognition". Dashes become spaces so the
 * copy reads as prose rather than as an API value.
 */
function taskPhrase(pipelineTag: string): string {
  const words = pipelineTag.replace(/-/g, ' ');
  const article = /^[aeiou]/i.test(words) ? 'an' : 'a';
  return `${article} ${words}`;
}

/**
 * Classify a model against the text engines. Order matters, and it's task-before-library: both
 * checks would block a Stable Diffusion repo, but only the task check can tell the user it's an
 * image model with a home in the templates flow. The library check then catches what the task check
 * can't see — repos with a missing or misleading pipeline tag.
 */
export function getModelCompatibility(model: HuggingFaceModel): ModelCompatibility {
  const tag = model.pipelineTag;
  const library = model.libraryName?.toLowerCase();

  // Task first: it yields the most specific, most actionable message. A text-to-image model is
  // reported as image generation (which has a home in the templates flow) rather than as a
  // "diffusers" packaging detail the user can do nothing about.
  if (tag && GENERATIVE_MEDIA_TAGS.has(tag)) {
    return {
      supported: false,
      kind: 'generative-media',
      reason: `This is ${taskPhrase(tag)} model. vLLM and llama.cpp serve text-generation models only — image, audio and video generation need a different runtime.`,
    };
  }

  if (tag && NON_GENERATIVE_TAGS.has(tag)) {
    return {
      supported: false,
      kind: 'non-generative',
      reason: `This is ${taskPhrase(tag)} model. It doesn't generate text, so it can't be served on a chat/completions endpoint.`,
    };
  }

  // Library next: catches repos whose tag is missing or looks servable but whose weights aren't in a
  // format either engine can load (e.g. a ComfyUI single-file upload carrying no pipeline tag).
  if (library && UNSUPPORTED_LIBRARIES.has(library)) {
    return {
      supported: false,
      kind: 'unsupported-library',
      reason: `This model ships as a ${model.libraryName} model. vLLM and llama.cpp load transformers-format text models only.`,
    };
  }

  if (!tag) {
    // No tag and no disqualifying library — can't prove it either way. Let the user through, but the
    // caller should warn: an untagged repo is often a config-only or non-standard upload.
    return { supported: true, unverified: true };
  }

  if (SERVABLE_PIPELINE_TAGS.has(tag)) {
    return { supported: true, unverified: false };
  }

  return {
    supported: false,
    kind: 'unsupported-task',
    reason: `This is ${taskPhrase(tag)} model, which isn't a text-inference task vLLM or llama.cpp can serve.`,
  };
}

/** Convenience predicate for filtering a grid. Unverified models count as selectable. */
export function isModelServable(model: HuggingFaceModel): boolean {
  return getModelCompatibility(model).supported;
}
