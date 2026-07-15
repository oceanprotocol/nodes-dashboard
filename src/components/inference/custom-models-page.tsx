import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import ModelCard from '@/components/inference/model-card';
import Input from '@/components/input/input';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import {
  FALLBACK_PIPELINE_TAGS,
  fetchHuggingFaceModels,
  fetchPipelineTags,
  PipelineTag,
} from '@/services/huggingface-service';
import { HuggingFaceModel } from '@/types/huggingface';
import { InferenceFlowType } from '@/types/inference';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import styles from './custom-models-page.module.css';

const VISIBLE_TAG_COUNT = 9;

const CustomModelsPage: React.FC = () => {
  const router = useRouter();

  const {
    selectedModels,
    selectSingleModel,
    isModelSelected,
    buildSelectionQuery,
    clearSelection,
    hydrateFromUrlFinished,
  } = useInferenceContext();

  /**
   * Single-model flow: selecting a model REPLACES the current selection (one model + one vLLM instance).
   * Clicking the already-selected model deselects it. selectSingleModel also prunes the previous
   * model's committed params, so switching A → B → A can't restore A's stale launch settings.
   * Keeps context an array for compatibility, but the flow only ever carries one entry.
   */
  const selectModel = (model: HuggingFaceModel) => {
    selectSingleModel(model);
  };
  // Editing a running service: skip the env step (same env) and go straight to config on Continue.
  const isEditMode = router.query.edit === '1';
  // Clear any leftover selection from a prior run when entering the picker fresh (no selection in the
  // URL). A Back-navigation into the picker carries `models` in the query, so that case is preserved.
  const freshEntryHandledRef = useRef(false);
  useEffect(() => {
    if (freshEntryHandledRef.current || !router.isReady || !hydrateFromUrlFinished) {
      return;
    }
    freshEntryHandledRef.current = true;
    if (!router.query.models) {
      clearSelection();
    }
  }, [router.isReady, router.query.models, hydrateFromUrlFinished, clearSelection]);

  const [models, setModels] = useState<HuggingFaceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [pipelineTags, setPipelineTags] = useState<PipelineTag[]>(FALLBACK_PIPELINE_TAGS);
  const [showAllTags, setShowAllTags] = useState(false);

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
        });
        if (!cancelled) {
          setModels(data);
          setNextCursor(cursor);
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
  }, [query, activeTag]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }
    const requestQuery = query;
    const requestTag = activeTag;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const { models: data, nextCursor: cursor } = await fetchHuggingFaceModels(requestQuery, {
        cursor: nextCursor,
        pipelineTag: requestTag ?? undefined,
      });
      if (requestQuery !== query || requestTag !== activeTag) {
        return;
      }
      setModels((prev) => [...prev, ...data]);
      setNextCursor(cursor);
    } catch (err) {
      if (requestQuery !== query || requestTag !== activeTag) {
        return;
      }
      setLoadMoreError(err instanceof Error ? err.message : 'Failed to load more models');
    } finally {
      setLoadingMore(false);
    }
  };

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

          <Input
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search models..."
            startAdornment={<SearchIcon className={styles.searchIcon} />}
            type="text"
            value={searchInput}
          />

          <div className={styles.filters}>
            <button
              className={cx('chip', styles.filterChip, { [styles.filterActive]: !activeTag })}
              onClick={() => setActiveTag(null)}
              type="button"
            >
              All
            </button>
            {pipelineTags.slice(0, VISIBLE_TAG_COUNT).map((tag) => (
              <button
                className={cx('chip', styles.filterChip, { [styles.filterActive]: activeTag === tag.id })}
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                type="button"
              >
                {tag.label}
              </button>
            ))}
            {pipelineTags.length > VISIBLE_TAG_COUNT && (
              <button className="chip chipAccent2" onClick={() => setShowAllTags((prev) => !prev)} type="button">
                {showAllTags ? 'Less filters' : 'More filters'}
                <ExpandMoreIcon className={cx(styles.moreChevron, { [styles.moreChevronOpen]: showAllTags })} />
              </button>
            )}
          </div>

          {pipelineTags.length > VISIBLE_TAG_COUNT && (
            <Collapse in={showAllTags} unmountOnExit>
              <div className={styles.filters}>
                {pipelineTags.slice(VISIBLE_TAG_COUNT).map((tag) => (
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
                {models.map((model) => (
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
    </Container>
  );
};

export default CustomModelsPage;
