import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import ModelCard from '@/components/inference/model-card';
import Input from '@/components/input/input';
import Select, { SelectOption } from '@/components/input/select';
import Modal from '@/components/modal/modal';
import SectionTitle from '@/components/section-title/section-title';
import config from '@/config';
import { useInferenceContext } from '@/context/inference-context';
import {
  DEFAULT_MODEL_SORT,
  FALLBACK_PIPELINE_TAGS,
  fetchHuggingFaceModels,
  fetchPipelineTags,
  getModelShortName,
  ModelSort,
  PipelineTag,
} from '@/services/huggingface-service';
import {
  getModelCompatibility,
  IncompatibilityKind,
  ModelCompatibility,
  SERVABLE_PIPELINE_TAGS,
} from '@/services/model-compatibility';
import { HuggingFaceModel } from '@/types/huggingface';
import { InferenceFlowType } from '@/types/inference';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './custom-models-page.module.css';

/**
 * Pipeline tags that aren't in SERVABLE_PIPELINE_TAGS but whose models can still be launched, so they
 * belong with the servable filters rather than behind "More filters". Both are conditionally
 * servable: a `translation`/`summarization` repo runs when it's a causal chat finetune and not an
 * encoder-decoder, which getModelCompatibility decides per model from its chat template.
 */
const CONDITIONALLY_SERVABLE_TAGS = ['translation', 'summarization'];

/**
 * What to tell the user per rejection kind — each ends mid-sentence, so the Discord link completes it.
 * Split by kind because the useful next step genuinely differs: media models have somewhere else to
 * go, embeddings/classifiers need a runtime we don't offer, and a packaging problem may be fixable by
 * finding another copy of the same model.
 */
const REJECTION_HINTS: Record<IncompatibilityKind, string> = {
  // Has a real destination — ComfyUI and friends are already published as services.
  'generative-media':
    'Image, audio and video models run on engines like ComfyUI instead — pick one, then add this model from its own UI. If none of them fit,',
  // Servable in principle, but by TEI/Infinity-style runtimes we don't offer, and not over the
  // chat/completions endpoint everything downstream of here assumes.
  // Deliberately not "embedding, ranking and classification": this kind also covers speech
  // recognition, OCR, detection and segmentation, and naming the wrong family reads as a
  // misclassification to anyone who picked a Whisper model.
  'non-generative': 'Models like this need a different kind of server than the ones we run. If you’d find that useful,',
  // The weights, not the task: another publisher's copy of the same model may load fine, so point at
  // that before treating it as unsupported.
  'unsupported-library':
    'The task may be fine — it’s the packaging vLLM and llama.cpp can’t load. A transformers-format copy of the same model usually works, so it is worth searching for one. If there isn’t any,',
  // Neither servable nor clearly categorised — the honest answer is "tell us".
  'unsupported-task': 'This isn’t a task we serve today. If it would be useful for your use case,',
  // Fully self-service: the base model is named on the adapter's own model card, and launching it
  // works today — so this points at the fix rather than at us.
  'adapter-only':
    'The adapter’s model card names the base model it was trained on — search for that one here and launch it instead. If you need the adapter’s weights merged in,',
  // Also self-service, and worth being concrete: the same model in a format we DO serve is usually
  // one search away, since popular models get AWQ/GPTQ republishes within days.
  'unsupported-quantization':
    'Searching this model’s name with “AWQ”, “GPTQ” or “FP8” usually turns up a copy that runs here, and the full-precision original always does. If neither works for you,',
};

const SORT_OPTIONS: SelectOption<ModelSort>[] = [
  { value: 'trendingScore', label: 'Trending' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'likes', label: 'Most liked' },
  { value: 'lastModified', label: 'Recently updated' },
  { value: 'createdAt', label: 'Newest' },
];

const CustomModelsPage: React.FC = () => {
  const router = useRouter();

  const {
    selectedModels,
    selectSingleModel,
    isModelSelected,
    buildSelectionQuery,
    clearSelection,
    hydrateFromUrlFinished,
    setEngine,
  } = useInferenceContext();

  // Edit mode skips env step (same env) → straight to config on Continue.
  const isEditMode = router.query.edit === '1';
  /**
   * Single-model flow: selecting a model REPLACES the selection. Clicking the selected model
   * deselects it. selectSingleModel also prunes the previous model's committed params, so
   * A → B → A can't restore A's stale launch settings.
   */
  // Models the text engines can't serve are refused here rather than in the engine dropdown: the
  // config step's launch flags are meaningless for a diffusion/embedding model, so blocking at
  // selection avoids leading the user into a form that can never produce a working launch.
  const [rejected, setRejected] = useState<{ model: HuggingFaceModel; compatibility: ModelCompatibility } | null>(null);

  const selectModel = (model: HuggingFaceModel) => {
    const compatibility = getModelCompatibility(model);
    if (!compatibility.supported) {
      setRejected({ model, compatibility });
      return;
    }
    setRejected(null);
    // A GGUF-only repo has no transformers weights for vLLM to load. Switching here is only the
    // immediate effect — the context derives the same constraint from the selection and enforces it
    // from then on, so a later switch back to vLLM is rejected rather than merely discouraged.
    if (compatibility.engines === 'llamacpp-only') {
      setEngine('llamacpp');
    }
    // Read before selectSingleModel — it toggles, so afterwards this would report the new state.
    const deselected = isModelSelected(model.id);
    selectSingleModel(model);
    posthog.capture('inference_model_selected', {
      modelId: model.id,
      pipelineTag: model.pipelineTag,
      source: 'custom',
      isEditMode,
      deselected,
      branch: 'custom',
    });
  };
  // Fresh entry (no `models` in URL): clear leftover selection. Back-nav carries `models`, so preserved.
  const freshEntryHandledRef = useRef(false);
  // Model the user arrived in edit mode with. Frozen once on entry: it stays pinned to the top of
  // the grid, while any model picked afterwards keeps its natural position in the list.
  const [pinnedModel, setPinnedModel] = useState<HuggingFaceModel | null>(null);
  useEffect(() => {
    if (freshEntryHandledRef.current || !router.isReady || !hydrateFromUrlFinished) {
      return;
    }
    freshEntryHandledRef.current = true;
    if (!router.query.models) {
      clearSelection();
      return;
    }
    if (isEditMode && selectedModels.length > 0) {
      setPinnedModel(selectedModels[0]);
    }
  }, [router.isReady, router.query.models, hydrateFromUrlFinished, clearSelection, isEditMode, selectedModels]);

  const [models, setModels] = useState<HuggingFaceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<ModelSort>(DEFAULT_MODEL_SORT);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [pipelineTags, setPipelineTags] = useState<PipelineTag[]>(FALLBACK_PIPELINE_TAGS);
  const [showAllTags, setShowAllTags] = useState(false);

  /**
   * Split the task filters by whether this flow can actually serve the task. The servable ones lead;
   * the rest sit behind "More filters" — still reachable, because a user searching for a known model
   * may well want to filter by its task and find out from the rejection modal why it can't run, but
   * no longer occupying the row the eye lands on first. HF's own ordering is by model count, which
   * puts image and video tasks ahead of every text task this flow exists to launch.
   */
  const [servableTags, otherTags] = useMemo(() => {
    const servable: PipelineTag[] = [];
    const other: PipelineTag[] = [];
    for (const tag of pipelineTags) {
      const isServable = SERVABLE_PIPELINE_TAGS.has(tag.id) || CONDITIONALLY_SERVABLE_TAGS.includes(tag.id);
      (isServable ? servable : other).push(tag);
    }
    return [servable, other];
  }, [pipelineTags]);

  // Live filter values, read inside an in-flight loadMore to detect a mid-request filter change and
  // drop the now-stale page. Synced in an effect (not during render) to stay concurrent-safe.
  const filterRef = useRef({ query, activeTag, sort });
  useEffect(() => {
    filterRef.current = { query, activeTag, sort };
  }, [query, activeTag, sort]);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    fetchPipelineTags().then((tags) => {
      if (!cancelled) {
        setPipelineTags(tags);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // First page (and reload on new query / tag filter).
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setLoadMoreError(null);
      try {
        const { models: data, nextCursor: cursor } = await fetchHuggingFaceModels(query, {
          pipelineTag: activeTag ?? undefined,
          sort,
        });
        if (!cancelled) {
          setModels(data);
          setNextCursor(cursor);
          if (query) {
            posthog.capture('inference_models_searched', {
              queryLength: query.length,
              resultCount: data.length,
              tag: activeTag ?? undefined,
              sort,
              branch: 'custom',
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setModels([]);
          setNextCursor(null);
          setError(err instanceof Error ? err.message : 'Failed to load models');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query, activeTag, sort]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }
    const request = { query, activeTag, sort };
    // Filter changed mid-flight → drop the result (don't append or show as error).
    const isStale = () =>
      request.query !== filterRef.current.query ||
      request.activeTag !== filterRef.current.activeTag ||
      request.sort !== filterRef.current.sort;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const { models: data, nextCursor: cursor } = await fetchHuggingFaceModels(request.query, {
        cursor: nextCursor,
        pipelineTag: request.activeTag ?? undefined,
        sort: request.sort,
      });
      if (isStale()) {
        return;
      }
      setModels((prev) => [...prev, ...data]);
      setNextCursor(cursor);
    } catch (err) {
      if (isStale()) {
        return;
      }
      setLoadMoreError(err instanceof Error ? err.message : 'Failed to load more models');
    } finally {
      setLoadingMore(false);
    }
  };

  // Only the model the user entered edit mode with is pinned first — it may sit on a later page (or
  // outside the active filter) and would otherwise be unreachable. Later picks don't reorder.
  const orderedModels = useMemo(() => {
    if (!pinnedModel) {
      return models;
    }
    return [pinnedModel, ...models.filter((model) => model.id !== pinnedModel.id)];
  }, [models, pinnedModel]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Select a custom model to run on an Ocean Node"
        contentBetween={
          <InferenceStepper currentStep="model" edit={isEditMode} flowType={InferenceFlowType.CustomModel} />
        }
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <h3>Models</h3>

          <div>
            Models are pulled directly from <strong>Hugging Face</strong> and served on vLLM.{' '}
            <strong>One model per instance</strong>. Gated models need an HF token.
          </div>

          <div className={styles.searchRow}>
            <Input
              className={styles.searchField}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search models..."
              startAdornment={<SearchIcon className={styles.searchIcon} />}
              size="sm"
              type="text"
              value={searchInput}
            />
            <Select
              className={styles.sortField}
              onChange={(event) => setSort(event.target.value as ModelSort)}
              options={SORT_OPTIONS}
              size="sm"
              startAdornment={<SwapVertIcon className={styles.sortIcon} />}
              value={sort}
            />
          </div>

          <div className={styles.filters}>
            <button
              className={cx('chip', styles.filterChip, { [styles.filterActive]: !activeTag })}
              onClick={() => setActiveTag(null)}
              type="button"
            >
              All
            </button>
            {servableTags.map((tag) => (
              <button
                className={cx('chip', styles.filterChip, { [styles.filterActive]: activeTag === tag.id })}
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                type="button"
              >
                {tag.label}
              </button>
            ))}
            {otherTags.length > 0 && (
              <button className="chip chipAccent2" onClick={() => setShowAllTags((prev) => !prev)} type="button">
                {showAllTags ? 'Fewer tasks' : 'Other tasks'}
                <ExpandMoreIcon className={cx(styles.moreChevron, { [styles.moreChevronOpen]: showAllTags })} />
              </button>
            )}
          </div>

          {otherTags.length > 0 && (
            <Collapse in={showAllTags} unmountOnExit>
              <div className={styles.filters}>
                {otherTags.map((tag) => (
                  <button
                    className={cx('chip', styles.filterChip, { [styles.filterActive]: activeTag === tag.id })}
                    key={tag.id}
                    onClick={() => setActiveTag(tag.id)}
                    type="button"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </Collapse>
          )}

          {loading && <div className={cx(styles.stateBox, 'textSecondary')}>Loading models…</div>}
          {error && <div className={cx(styles.stateBox, 'textErrorDarker')}>{error}</div>}

          {!loading && !error && models.length > 0 && (
            <>
              <div className={styles.grid}>
                {orderedModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    onToggle={selectModel}
                    selected={isModelSelected(model.id)}
                    showStats
                  />
                ))}
              </div>
              {loadMoreError && <div className={cx(styles.stateBox, 'textErrorDarker')}>{loadMoreError}</div>}
              {nextCursor && (
                <Button
                  className="alignSelfCenter"
                  color="accent2"
                  loading={loadingMore}
                  onClick={loadMore}
                  variant="filled"
                >
                  Load more
                </Button>
              )}
            </>
          )}

          {!loading && !error && models.length === 0 && (
            <div className={styles.stateBox}>
              {query ? `No models found for “${query}”.` : 'No models found for this filter.'}
            </div>
          )}
        </Card>
        <InferenceNavigation
          nextDisabled={selectedModels.length === 0}
          nextLabel="Continue"
          onNext={() =>
            router.push({
              pathname: isEditMode ? '/inference/custom-models/config' : '/inference/custom-models/resources',
              query: buildSelectionQuery(),
            })
          }
          onPrev={() => router.replace('/inference')}
          onRemoveModel={selectModel}
        />
      </div>

      {/* Unsupported pick — explains why, and routes media models to the flow that can serve them. */}
      <Modal isOpen={!!rejected} onClose={() => setRejected(null)} title="Model not supported" width="xs" fullWidth>
        {rejected && !rejected.compatibility.supported && (
          <>
            <p className={styles.rejectedModel}>{getModelShortName(rejected.model.id)}</p>
            <p className={styles.rejectedReason}>{rejected.compatibility.reason}</p>
            <p className={cx(styles.rejectedHint, 'textSecondary')}>
              {REJECTION_HINTS[rejected.compatibility.kind]}{' '}
              <a className="textAccent1" href={config.socialMedia.discord} rel="noreferrer" target="_blank">
                reach us on Discord
              </a>
              .
            </p>
            <div className="actionsGroupMdEnd">
              {rejected.compatibility.kind === 'generative-media' && (
                <Button color="accent1" href="/inference/services" size="md" variant="outlined">
                  Browse services
                </Button>
              )}
              <Button color="accent1" onClick={() => setRejected(null)} size="md" type="button" variant="filled">
                Pick another model
              </Button>
            </div>
          </>
        )}
      </Modal>
    </Container>
  );
};

export default CustomModelsPage;
