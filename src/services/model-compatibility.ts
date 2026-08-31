import { HuggingFaceModel } from '@/types/huggingface';

/**
 * Can this Hugging Face model be served by the engines this dashboard launches (vLLM, llama.cpp)?
 * Both are OpenAI-compatible text servers: they sample tokens from a causal LM. Anything generating
 * images/audio/video, or only emitting embeddings and labels, cannot run on either.
 *
 * ## The principle
 *
 * Reject only on positive evidence of incompatibility. Accept everything else, including anything
 * ambiguous.
 *
 * The two errors are not symmetric. A false rejection blocks a model that would have run and the
 * user has no override; a false acceptance costs one launch that fails in the container. So every
 * check below answers "is there proof this CAN'T run?", never "is there proof it can?".
 *
 * That principle sets each rule's shape:
 *
 * - **Pipeline tags are allowlisted** — a controlled vocabulary of ~52 values, where an unrecognised
 *   one is far more likely to be a new media task than a new way to sample text.
 * - **Libraries are blocklisted** — free text, where real repos declare `vllm`, `sglang`,
 *   `Model Optimizer`, `grok`. Allowlisting rejected all of those, and all were servable.
 * - **A chat template overrides the tag.** It is the one positive signal strong enough to outrank a
 *   tag, because only a chat model has one. It rescues repos whose tag is wrong or unrecognised, and
 *   is what keeps a pipeline tag added by HF tomorrow from silently rejecting the models under it.
 *   It applies to seq2seq tags, unrecognised tags, and the perception tags a multimodal LLM gets
 *   filed under — but never to the embedding and ranking tags, whose models are causal-backboned and
 *   would all slip through. Its absence proves nothing: base models have no chat template either.
 * - **Weight-format tags need the repo id to agree.** Many repos publish a secondary ONNX or TFLite
 *   export next to the real weights, so the tag alone would reject them.
 *
 * ## Order
 *
 * First match wins, ordered by how actionable the message is, not by cost:
 * adapter → task → embeddings marker → weight format → quantization.
 *
 * ## Scope
 *
 * Reads only what HF's LIST response carries: `id`, `pipelineTag`, `libraryName`, `tags`. That gates
 * a whole grid with no per-model fetch. Anything needing `config.json` runs after selection — see
 * `getArchitectureIncompatibility`. Nothing here checks VRAM, the engine's architecture registry, or
 * `custom_code`.
 *
 * ## Known false accepts
 *
 * Untagged encoder uploads (`google/electra-base-discriminator`), and any repo whose only
 * disqualifying trait needs the config fetch to see. Both are the cheap error by design.
 */

/** Why a model isn't servable — selects the copy shown to the user. */
export type IncompatibilityKind =
  /** Generates images/audio/video. Needs a diffusion/media runtime. */
  | 'generative-media'
  /** Emits embeddings, scores or labels — nothing to serve over chat/completions. */
  | 'non-generative'
  /** Not a text-inference task at all (robotics, RL, tabular, graph), or a seq2seq head. */
  | 'unsupported-task'
  /** Weights in a format neither engine can load. */
  | 'unsupported-library'
  /** A LoRA adapter — the real weights live in a separate base repo. */
  | 'adapter-only'
  /** Pre-quantized with bitsandbytes. */
  | 'unsupported-quantization';

/**
 * Engines a servable model can actually run on. A GGUF-only repo has no transformers weights for
 * vLLM, so llama.cpp is its only option and the caller preselects it.
 */
export type ServableEngines = 'both' | 'llamacpp-only';

export type ModelCompatibility =
  | { supported: true; engines: ServableEngines }
  | { supported: false; kind: IncompatibilityKind; reason: string };

/** `*-text-to-text` are multimodal input with text output. */
export const SERVABLE_PIPELINE_TAGS = new Set([
  'text-generation',
  'image-text-to-text',
  'audio-text-to-text',
  'video-text-to-text',
  // May or may not expose a text path; accepted because the omni models Ocean nodes run do.
  'any-to-any',
]);

/** Generates non-text media. Separate from the other refusals so the copy can point at templates. */
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

/** Emits vectors, scores or labels. Servable by TEI-style runtimes, but not over chat/completions. */
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
  // Extractive QA heads select a span of the input. A chat model that answers questions is tagged
  // text-generation instead.
  'question-answering',
  'document-question-answering',
  'visual-question-answering',
  'table-question-answering',
]);

/**
 * Encoder-decoder (t5, nllb, opus-mt) unless a chat template says otherwise. `text2text-generation`
 * is T5's own retired tag — HF returns no models under it now — kept here so a stale repo lands on
 * the same verdict as the identical model tagged `translation`.
 */
const AMBIGUOUS_TEXT_TAGS = new Set(['summarization', 'translation', 'text2text-generation']);

/** Set when the repo ships a chat template. Only a chat model has one; absence proves nothing. */
const CHAT_TEMPLATE_TAG = 'conversational';

/** NON_GENERATIVE_TAGS a multimodal LLM gets filed under, so a chat template outranks them. */
const PERCEPTION_TAGS = new Set([
  'image-to-text',
  'visual-question-answering',
  'document-question-answering',
  'question-answering',
  'automatic-speech-recognition',
]);

/** HF's marker for a repo served by TEI. Catches embedding repos whose pipeline tag is missing. */
const EMBEDDINGS_MARKER_TAG = 'text-embeddings-inference';

/** Libraries whose weights neither engine can load. */
const UNSUPPORTED_LIBRARIES = new Set([
  // Different modality.
  'diffusers',
  // ComfyUI / A1111 single-file checkpoints. These ship no pipeline tag, so the task check misses them.
  'diffusion-single-file',
  'dduf',
  'timm',
  'ultralytics',
  'unidepth',
  'open_clip',
  'espnet',
  'nemo',
  'speechbrain',
  'asteroid',
  'pyannote-audio',
  // Embeddings and task-specific NLP pipelines.
  'sentence-transformers',
  'setfit',
  'flair',
  'span-marker',
  'stanza',
  'spacy',
  'allennlp',
  'bertopic',
  'fasttext',
  // Different runtime target. The `mlx-*` variants aren't in HF's facet list but real repos set them.
  'mlx',
  'mlx-lm',
  'mlx-vlm',
  'onnx',
  'openvino',
  'coreml',
  'tflite',
  'executorch',
  'transformers.js',
  'unity-sentis',
  'llamafile',
  'optimum_habana',
  'optimum_graphcore',
  // Different framework.
  'tf',
  'jax',
  'keras',
  'tf-keras',
  'keras-hub',
  'paddlepaddle',
  'paddlenlp',
  'paddleocr',
  'fairseq',
  'fastai',
  // Classical ML and RL artefacts.
  'sklearn',
  'joblib',
  'stable-baselines3',
  'ml-agents',
  'sample-factory',
]);

/** Libraries meaning "this repo is GGUF" — servable, but only on llama.cpp. */
const GGUF_LIBRARIES = new Set(['gguf', 'llama.cpp', 'llamacpp']);

/** Libraries meaning "this repo is an adapter", holding deltas rather than weights. */
const ADAPTER_LIBRARIES = new Set(['peft', 'adapter-transformers']);

/**
 * Only consulted when the repo declares no library: these mark how a model was trained, so merged
 * models keep them. `lora` is excluded — it's also the standard tag on diffusion LoRAs.
 */
const ADAPTER_TAGS = new Set(['peft', 'adapter-transformers']);

/** Weight formats that show up as a tag when `library_name` doesn't admit them. */
const UNSUPPORTED_RUNTIME_TAGS = ['mlx', 'onnx', 'openvino', 'coreml', 'tflite', 'executorch', 'unity-sentis'];

/** bitsandbytes weights. Only this explicit tag counts — `4-bit`/`8-bit` also sit on AWQ/GPTQ/FP4. */
const BITSANDBYTES_TAGS = new Set(['bitsandbytes']);

/** Prettier names for the formats we refuse; HF's slugs read as typos in a sentence. */
const FORMAT_DISPLAY_NAMES: Record<string, string> = {
  mlx: 'MLX',
  onnx: 'ONNX',
  openvino: 'OpenVINO',
  coreml: 'Core ML',
  tflite: 'LiteRT',
  executorch: 'ExecuTorch',
  'transformers.js': 'Transformers.js',
  'unity-sentis': 'Unity Sentis',
  llamafile: 'llamafile',
  diffusers: 'Diffusers',
  'sentence-transformers': 'sentence-transformers',
  keras: 'Keras',
  'tf-keras': 'TF-Keras',
  tf: 'TensorFlow',
  jax: 'JAX',
  timm: 'timm',
  espnet: 'ESPnet',
  nemo: 'NeMo',
  spacy: 'spaCy',
  fairseq: 'Fairseq',
  paddlepaddle: 'PaddlePaddle',
  paddlenlp: 'paddlenlp',
  sklearn: 'Scikit-learn',
  fastai: 'fastai',
  rust: 'Rust',
};

/**
 * The `<model>-GGUF` naming convention. Not end-anchored — many repos append the quant
 * (`…-GGUF-IQ4_XS`). Shared with `guessGgufRepo` so the two can't drift.
 */
export function isGgufRepoId(modelId: string): boolean {
  return /(^|[-/])gguf([-.]|$)/i.test(modelId);
}

/** A repo whose weights ARE the converted format names it (`mlx-community/…`); an export doesn't. */
function formatNamedInId(format: string, modelId: string): boolean {
  const id = modelId.toLowerCase();
  const needle = format.toLowerCase();
  // Bounded by non-alphanumerics so `onnx` doesn't fire on a name that merely contains the letters.
  return new RegExp(`(^|[^a-z0-9])${needle.replace(/[.\\]/g, '\\$&')}([^a-z0-9]|$)`).test(id);
}

/** GGUF and nothing else. The tag alone isn't enough — base repos publish GGUF conversions too. */
function isGgufOnly(library: string | undefined, tags: string[], modelId: string): boolean {
  if (library && GGUF_LIBRARIES.has(library)) {
    return true;
  }
  if (library && library !== 'transformers') {
    return false;
  }
  return tags.includes('gguf') && isGgufRepoId(modelId);
}

/** `text-to-audio` → "a text-to-audio"; `automatic-speech-recognition` → "an automatic speech…". */
function taskPhrase(pipelineTag: string): string {
  const words = pipelineTag.replace(/-/g, ' ');
  const article = /^[aeiou]/i.test(words) ? 'an' : 'a';
  return `${article} ${words}`;
}

function unsupportedFormatReason(format: string): string {
  const name = FORMAT_DISPLAY_NAMES[format] ?? format;
  return `These weights are in ${name} format, which vLLM and llama.cpp can’t load. Look for a transformers-format copy of the same model.`;
}

/**
 * Encoder and task-specific heads — never generative. Deliberately narrow: `ForConditionalGeneration`
 * covers both T5 (unservable) and modern VLMs (servable), and `GPT2LMHeadModel` has no `For*` suffix
 * at all, so neither can be judged from the name.
 */
const NON_GENERATIVE_ARCHITECTURE_SUFFIXES = [
  'ForMaskedLM',
  'ForPreTraining',
  'ForSequenceClassification',
  'ForTokenClassification',
  'ForQuestionAnswering',
  'ForMultipleChoice',
  'ForImageClassification',
  'ForObjectDetection',
  'ForSemanticSegmentation',
  'ForDepthEstimation',
  'ForCTC',
  'ForAudioClassification',
  'ForForecasting',
];

/**
 * Post-selection check on `config.json`'s architecture, which the list response lacks. Runs ALONGSIDE
 * getModelCompatibility, not instead of it: this catches untagged encoders, while only the pipeline
 * tag catches embedders built on a causal backbone (`Qwen3-Embedding` is `Qwen3ForCausalLM`).
 * Returns null when the architecture proves nothing, which is the common case.
 */
export function getArchitectureIncompatibility(architecture: string | null | undefined): string | null {
  if (!architecture) {
    return null;
  }
  const suffix = NON_GENERATIVE_ARCHITECTURE_SUFFIXES.find((s) => architecture.endsWith(s));
  if (!suffix) {
    return null;
  }
  return `This repo's architecture is ${architecture}, which isn't a generative language model — vLLM and llama.cpp can't serve it. It will fail to start.`;
}

/** Classify a model against the text engines. See the file header for the check order and its rationale. */
export function getModelCompatibility(model: HuggingFaceModel): ModelCompatibility {
  const tag = model.pipelineTag;
  const library = model.libraryName?.toLowerCase();
  const tags = (model.tags ?? []).map((t) => t.toLowerCase());
  const engines: ServableEngines = isGgufOnly(library, tags, model.id) ? 'llamacpp-only' : 'both';

  // First: a LoRA repo inherits its base model's tag and library, so nothing below would see it.
  const adapterByTag = !library && tags.some((t) => ADAPTER_TAGS.has(t));
  if ((library && ADAPTER_LIBRARIES.has(library)) || adapterByTag) {
    return {
      supported: false,
      kind: 'adapter-only',
      reason:
        'This is a LoRA adapter, not a full model — the repo holds only the fine-tuned deltas, not the weights themselves. Launch the base model it was trained on instead.',
    };
  }

  // Ahead of format, so a Stable Diffusion repo reads as an image model, not a packaging detail.
  if (tag && GENERATIVE_MEDIA_TAGS.has(tag)) {
    return {
      supported: false,
      kind: 'generative-media',
      reason: `This is ${taskPhrase(tag)} model. vLLM and llama.cpp serve text-generation models only — image, audio and video generation need a different runtime.`,
    };
  }

  if (tag && NON_GENERATIVE_TAGS.has(tag) && !(PERCEPTION_TAGS.has(tag) && tags.includes(CHAT_TEMPLATE_TAG))) {
    return {
      supported: false,
      kind: 'non-generative',
      reason: `This is ${taskPhrase(tag)} model. It doesn't generate text, so it can't be served on a chat/completions endpoint.`,
    };
  }

  // HF's TEI marker, for embedding repos the tag check can't see.
  if (tags.includes(EMBEDDINGS_MARKER_TAG)) {
    return {
      supported: false,
      kind: 'non-generative',
      reason:
        'This is an embeddings model. It produces vectors rather than generated text, so it can’t be served on a chat/completions endpoint.',
    };
  }

  // Library, or tags with the id agreeing — `library_name` is often absent or wrong. Must precede
  // quantization: these repos are usually quantized too, and would otherwise be blamed on that.
  const unsupportedFormat =
    library && UNSUPPORTED_LIBRARIES.has(library)
      ? library
      : UNSUPPORTED_RUNTIME_TAGS.find((t) => tags.includes(t) && formatNamedInId(t, model.id));
  if (unsupportedFormat) {
    return { supported: false, kind: 'unsupported-library', reason: unsupportedFormatReason(unsupportedFormat) };
  }

  // Skipped for GGUF, whose quantization is llama.cpp's own.
  if (engines !== 'llamacpp-only' && tags.some((t) => BITSANDBYTES_TAGS.has(t))) {
    return {
      supported: false,
      kind: 'unsupported-quantization',
      reason:
        'These weights are pre-quantized with bitsandbytes, which vLLM and llama.cpp can’t load. Launch the full-precision base model instead, or an AWQ, GPTQ or FP8 copy of it.',
    };
  }

  // Nothing disqualified it.
  if (!tag || SERVABLE_PIPELINE_TAGS.has(tag)) {
    return { supported: true, engines };
  }

  if (AMBIGUOUS_TEXT_TAGS.has(tag)) {
    if (tags.includes(CHAT_TEMPLATE_TAG)) {
      return { supported: true, engines };
    }
    return {
      supported: false,
      kind: 'unsupported-task',
      reason: `This is ${taskPhrase(tag)} model built as an encoder-decoder, which vLLM and llama.cpp can’t serve — they run causal language models only.`,
    };
  }

  // Tag we don't classify. A chat template outranks it: these are chat LLMs filed under an odd tag
  // (`reinforcement-learning` and `graph-ml` are full of them), and it's what stops a tag HF adds
  // later from rejecting every model under it. Genuinely non-text tasks never carry one.
  if (tags.includes(CHAT_TEMPLATE_TAG)) {
    return { supported: true, engines };
  }

  return {
    supported: false,
    kind: 'unsupported-task',
    reason: `This is ${taskPhrase(tag)} model, which isn't a text-inference task vLLM or llama.cpp can serve.`,
  };
}
