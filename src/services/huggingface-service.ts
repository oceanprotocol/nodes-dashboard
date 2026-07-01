import { HuggingFaceModel, HuggingFaceModelConfig, ToolCallParser } from '@/types/huggingface';
import axios from 'axios';

// Hugging Face Hub API reference: https://huggingface.co/spaces/huggingface/openapi

// List/get models — GET /api/models, GET /api/models/{namespace}/{repo}
const HF_API_URL = 'https://huggingface.co/api/models';
// Resolve a file — GET /{namespace}/{repo}/resolve/{rev}/{path}
const HF_RESOLVE_URL = 'https://huggingface.co';

// Network calls abort after this long so a hung HF request can't freeze the UI.
const REQUEST_TIMEOUT_MS = 15000;

const http = axios.create({ timeout: REQUEST_TIMEOUT_MS });

/**
 * Error-handling contract for this module:
 * - List/get-model calls (fetchHuggingFaceModels/Model) THROW on failure — the caller renders an error state.
 * - Repo-file reads (fetchModelFile / fetchHuggingFaceModelConfig) return null for a missing/unreadable file,
 *   but THROW HuggingFaceAuthError when the file is gated/private so the caller can prompt for a token.
 * - fetchPipelineTags SWALLOWS errors and returns FALLBACK_PIPELINE_TAGS (filters must always render).
 */

/** Encode an HF model id for use in a URL path, preserving the `namespace/repo` slash. */
function encodeModelPath(modelId: string): string {
  return modelId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

type RawHfConfig = {
  architectures?: string[];
  model_type?: string;
  max_position_embeddings?: number;
  torch_dtype?: string;
  quantization_config?: { quant_method?: string };
};

type RawHfTokenizerConfig = {
  // Either a single template string or a list of named templates.
  chat_template?: string | { name?: string; template?: string }[];
};

/** A chat template references tools when it mentions the `tools`/`tool_calls` variables vLLM feeds it. */
function chatTemplateSupportsTools(chatTemplate: RawHfTokenizerConfig['chat_template']): boolean {
  const templates = Array.isArray(chatTemplate) ? chatTemplate.map((t) => t.template ?? '') : [chatTemplate ?? ''];
  return templates.some((t) => /\btool_calls\b|\btools\b/.test(t));
}

/** Thrown when a repo file needs auth (gated/private model) — caller can prompt for an HF token. */
export class HuggingFaceAuthError extends Error {
  constructor(modelId: string) {
    super(`"${modelId}" is gated or private — an access token is required.`);
    this.name = 'HuggingFaceAuthError';
  }
}

/**
 * Resolve a single file from a model repo at a given revision (default `main`).
 * 401/403 throw HuggingFaceAuthError; any other failure resolves to null (treat as "file absent").
 */
async function fetchModelFile<T>(modelId: string, file: string, token?: string, revision = 'main'): Promise<T | null> {
  const rev = encodeURIComponent(revision || 'main');
  let response;
  try {
    response = await http.get<T>(`${HF_RESOLVE_URL}/${encodeModelPath(modelId)}/resolve/${rev}/${file}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      responseType: 'json',
      validateStatus: () => true,
    });
  } catch {
    return null;
  }
  if (response.status === 401 || response.status === 403) {
    throw new HuggingFaceAuthError(modelId);
  }
  if (response.status < 200 || response.status >= 300) {
    return null;
  }
  return response.data;
}

/** Like fetchModelFile but returns raw text (for non-JSON repo files, e.g. chat_template.jinja). */
async function fetchModelTextFile(
  modelId: string,
  file: string,
  token?: string,
  revision = 'main'
): Promise<string | null> {
  const rev = encodeURIComponent(revision || 'main');
  let response;
  try {
    response = await http.get<string>(`${HF_RESOLVE_URL}/${encodeModelPath(modelId)}/resolve/${rev}/${file}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      responseType: 'text',
      validateStatus: () => true,
    });
  } catch {
    return null;
  }
  if (response.status === 401 || response.status === 403) {
    throw new HuggingFaceAuthError(modelId);
  }
  if (response.status < 200 || response.status >= 300) {
    return null;
  }
  return response.data;
}

type RawHfModel = {
  id: string;
  author?: string;
  lastModified?: string;
  likes?: number;
  downloads?: number;
  trendingScore?: number;
  pipeline_tag?: string;
  tags?: string[];
  library_name?: string;
  gated?: boolean | string;
};

function mapModel(raw: RawHfModel): HuggingFaceModel {
  return {
    id: raw.id,
    author: raw.author,
    lastModified: raw.lastModified,
    likes: raw.likes,
    downloads: raw.downloads,
    trendingScore: raw.trendingScore,
    pipelineTag: raw.pipeline_tag,
    tags: raw.tags,
    libraryName: raw.library_name,
    gated: raw.gated,
  };
}

export type PipelineTag = {
  id: string;
  label: string;
};

/** Fallback list if the HF tags endpoint is unreachable. */
export const FALLBACK_PIPELINE_TAGS: PipelineTag[] = [
  { id: 'text-generation', label: 'Text Generation' },
  { id: 'image-text-to-text', label: 'Image Text To Text' },
  { id: 'text-to-image', label: 'Text To Image' },
  { id: 'automatic-speech-recognition', label: 'Automatic Speech Recognition' },
  { id: 'image-to-video', label: 'Image To Video' },
  { id: 'any-to-any', label: 'Any To Any' },
  { id: 'text-to-video', label: 'Text To Video' },
  { id: 'text-to-speech', label: 'Text To Speech' },
];

type RawTag = { id: string; label: string; type: string };

// HF's tags endpoint carries no popularity/count field, so we approximate it: the tags with the most
// models (and the ones most relevant to inference) are pinned to the front; everything else keeps HF order.
const TAG_POPULARITY_ORDER = [
  'text-generation',
  'image-text-to-text',
  'text-to-image',
  'automatic-speech-recognition',
  'text-to-speech',
  'text-to-video',
  'image-to-video',
  'translation',
  'any-to-any',
];

/** Stable sort by curated popularity: ranked tags first (in order), unranked tags after in HF order. */
function orderTagsByPopularity(tags: PipelineTag[]): PipelineTag[] {
  const rankOf = (id: string) => {
    const index = TAG_POPULARITY_ORDER.indexOf(id);
    return index === -1 ? TAG_POPULARITY_ORDER.length : index;
  };
  return tags
    .map((tag, index) => ({ tag, index }))
    .sort((a, b) => rankOf(a.tag.id) - rankOf(b.tag.id) || a.index - b.index)
    .map((entry) => entry.tag);
}

/**
 * Fetch the full list of HF pipeline tags (used as model filters), ordered by curated popularity.
 */
export async function fetchPipelineTags(): Promise<PipelineTag[]> {
  try {
    const response = await http.get<{ pipeline_tag?: RawTag[] }>(`${HF_RESOLVE_URL}/api/models-tags-by-type`);
    const data = response.data;
    const rawTags = Array.isArray(data?.pipeline_tag) ? data.pipeline_tag : [];
    const tags = rawTags.map((t) => ({ id: t.id, label: t.label }));
    return tags.length > 0 ? orderTagsByPopularity(tags) : FALLBACK_PIPELINE_TAGS;
  } catch {
    return FALLBACK_PIPELINE_TAGS;
  }
}

export type HuggingFaceModelsPage = {
  models: HuggingFaceModel[];
  /** Opaque cursor for the next page, or null when there are no more results. */
  nextCursor: string | null;
};

/** HF paginates via a `Link: rel="next"` header carrying an opaque `cursor` token. */
function parseNextCursor(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  if (!match) {
    return null;
  }
  try {
    return new URL(match[1]).searchParams.get('cursor');
  } catch {
    return null;
  }
}

/**
 * List models with search/sort/filter + cursor pagination.
 */
export async function fetchHuggingFaceModels(
  query?: string,
  { limit = 50, cursor, pipelineTag }: { limit?: number; cursor?: string; pipelineTag?: string } = {}
): Promise<HuggingFaceModelsPage> {
  const params = new URLSearchParams({
    limit: String(limit),
    full: 'true',
  });

  const trimmed = query?.trim();
  if (trimmed) {
    params.set('search', trimmed);
    params.set('sort', 'downloads');
  } else {
    params.set('sort', 'trendingScore');
  }
  params.set('direction', '-1');
  if (pipelineTag) {
    params.set('pipeline_tag', pipelineTag);
  }
  if (cursor) {
    params.set('cursor', cursor);
  }

  let response;
  try {
    response = await http.get<unknown>(`${HF_API_URL}?${params.toString()}`);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      throw new Error(`Failed to fetch Hugging Face models (${err.response.status})`);
    }
    throw new Error('Could not reach Hugging Face. Check your connection and try again.');
  }

  const data = response.data;
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response from Hugging Face.');
  }
  return {
    models: (data as RawHfModel[]).filter((m) => !!m?.id).map(mapModel),
    nextCursor: parseNextCursor(response.headers['link'] ?? null),
  };
}

/**
 * Get a single model by id.
 */
export async function fetchHuggingFaceModel(modelId: string): Promise<HuggingFaceModel> {
  let response;
  try {
    response = await http.get<unknown>(`${HF_API_URL}/${encodeModelPath(modelId)}`);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      if (err.response.status === 404) {
        throw new Error(`Model "${modelId}" not found on Hugging Face.`);
      }
      throw new Error(`Failed to fetch model "${modelId}" (${err.response.status})`);
    }
    throw new Error('Could not reach Hugging Face. Check your connection and try again.');
  }

  const data: unknown = response.data;
  if (!data || typeof data !== 'object' || typeof (data as RawHfModel).id !== 'string') {
    throw new Error(`Unexpected response for model "${modelId}".`);
  }
  return mapModel(data as RawHfModel);
}

/**
 * Pulls per-model engine defaults from HF config.json (context ceiling, dtype, arch, quantization)
 * and tool support from the chat template (tokenizer_config.json + standalone chat_template.jinja).
 * Returns nulls for anything missing — caller falls back to its own defaults.
 * Pass `token` for gated/private models; throws HuggingFaceAuthError if auth is required and missing/invalid.
 * Pass `revision` to pin a commit/branch (defaults to `main`).
 */
export async function fetchHuggingFaceModelConfig(
  modelId: string,
  token?: string,
  revision?: string
): Promise<HuggingFaceModelConfig> {
  const [config, tokenizerConfig, chatTemplateFile] = await Promise.all([
    fetchModelFile<RawHfConfig>(modelId, 'config.json', token, revision),
    fetchModelFile<RawHfTokenizerConfig>(modelId, 'tokenizer_config.json', token, revision),
    // Some models ship the chat template as a standalone file instead of inside tokenizer_config.json.
    fetchModelTextFile(modelId, 'chat_template.jinja', token, revision),
  ]);

  const supportsTools =
    chatTemplateSupportsTools(tokenizerConfig?.chat_template) || chatTemplateSupportsTools(chatTemplateFile ?? undefined);

  return {
    architecture: config?.architectures?.[0] ?? null,
    modelType: config?.model_type ?? null,
    maxContext: config?.max_position_embeddings ?? null,
    torchDtype: config?.torch_dtype ?? null,
    quantizationMethod: config?.quantization_config?.quant_method ?? null,
    supportsTools,
  };
}

/**
 * Best-effort guess of the vLLM `--tool-call-parser` from model family (config.json model_type/architecture).
 * Returns null when nothing matches — the caller must then require an explicit choice.
 */
export function inferToolCallParser(config: HuggingFaceModelConfig | null): ToolCallParser | null {
  const hay = `${config?.modelType ?? ''} ${config?.architecture ?? ''}`.toLowerCase();
  if (/llama4/.test(hay)) {
    return 'llama4_json';
  }
  if (/llama|mllama/.test(hay)) {
    return 'llama3_json';
  }
  if (/mistral|mixtral|ministral/.test(hay)) {
    return 'mistral';
  }
  if (/granite/.test(hay)) {
    return 'granite';
  }
  if (/internlm/.test(hay)) {
    return 'internlm';
  }
  if (/jamba/.test(hay)) {
    return 'jamba';
  }
  if (/deepseek/.test(hay)) {
    return 'deepseek_v3';
  }
  // Hermes-style is the common default for Qwen and many fine-tunes.
  if (/qwen|hermes/.test(hay)) {
    return 'hermes';
  }
  return null;
}

/** Short display name for a model id — the repo part after the `author/` prefix. */
export function getModelShortName(modelId: string): string {
  return modelId.includes('/') ? modelId.split('/')[1] : modelId;
}

/** Encode selected model ids into the `models` query param value. */
export function encodeModelIds(ids: string[]): string {
  return ids.map((id) => encodeURIComponent(id)).join(',');
}

/** Decode the `models` query param (string | string[] from Next router) into model ids. */
export function decodeModelIds(raw: string | string[] | undefined): string[] {
  if (!raw) {
    return [];
  }
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  return value
    .split(',')
    .map((part) => decodeURIComponent(part.trim()))
    .filter(Boolean);
}

/**
 * Build the org avatar URL for a model's author.
 */
export function getModelAvatarUrl(model: HuggingFaceModel): string | undefined {
  if (!model.author) {
    return undefined;
  }
  return `https://huggingface.co/api/organizations/${encodeURIComponent(model.author)}/avatar`;
}
