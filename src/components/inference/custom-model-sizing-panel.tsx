import { CustomModelSizingGaps, FALLBACK_CONTEXT_TOKENS } from '@/services/vram-estimate';
import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CircularProgress } from '@mui/material';
import cx from 'classnames';
import { forwardRef, KeyboardEvent, useId, useImperativeHandle, useRef } from 'react';
import styles from './custom-model-sizing-panel.module.css';

/** One context-length option: its value (as the picker's onChange expects it) and how it reads. */
export type ContextChoice = {
  value: string;
  /** Short size, e.g. "256K". */
  label: string;
  /** Muted qualifier after the label, e.g. "max". */
  suffix?: string;
};

/** One estimated layout: this many GPUs, each with at least this much memory. */
export type SizingLayout = { gpus: number; gbPerGpu: number };

export type CustomModelSizingPanelProps = {
  contextChoices: ContextChoice[];
  contextValue: string;
  onContextChange: (value: string) => void;
  /** No max context is known: a single disabled choice (`contextChoices[0]`) stands in for the options. */
  contextUnknown?: boolean;
  /** The model's config is still loading: the context stays usable, the estimate shows a placeholder. */
  loading?: boolean;
  /** The estimated layouts; null when there is no estimate. */
  layouts: SizingLayout[] | null;
  /** GPU counts the model's attention heads split across; null when unknown. */
  widths: number[] | null;
  gaps?: Partial<CustomModelSizingGaps>;
  /** No environment holds the estimate: ring the context control, the thing to change. */
  highlightContext?: boolean;
};

export type CustomModelSizingPanelHandle = {
  /** Scroll the context control into view and focus its checked option. */
  focusContext: () => void;
};

/** "1", "1 or 2", "1, 2, 4 or 8". */
export function joinOr(values: (string | number)[]): string {
  const items = values.map(String);
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** A token count in the picker's short form: 8K, 256K, 1M, else the exact number. */
export function formatTokensShort(tokens: number): string {
  if (tokens >= 1024 * 1024 && tokens % (1024 * 1024) === 0) {
    return `${tokens / (1024 * 1024)}M`;
  }
  return tokens % 1024 === 0 ? `${tokens / 1024}K` : tokens.toLocaleString('en-US');
}

/**
 * The custom-model sizing block at the top of the Environments card: the context length to size for
 * (a radio group) beside the GPU memory the model is estimated to need at it, one chip per layout, with
 * the checks that couldn't be made as low-emphasis notes underneath. Presentation only — the picker owns
 * the estimate, the options and what a change does.
 */
const CustomModelSizingPanel = forwardRef<CustomModelSizingPanelHandle, CustomModelSizingPanelProps>(
  function CustomModelSizingPanel(
    {
      contextChoices,
      contextValue,
      onContextChange,
      contextUnknown = false,
      loading = false,
      layouts,
      widths,
      gaps = {},
      highlightContext = false,
    },
    ref
  ) {
    const id = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const groupRef = useRef<HTMLDivElement>(null);
    const choices = contextUnknown ? contextChoices.slice(0, 1) : contextChoices;
    const checkedIndex = Math.max(
      0,
      choices.findIndex((choice) => choice.value === contextValue)
    );

    const radios = () => Array.from(groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []);

    useImperativeHandle(ref, () => ({
      focusContext: () => {
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        radios()[checkedIndex]?.focus({ preventScroll: true });
      },
    }));

    // Radio-group keys: arrows move and select (wrapping), Home/End jump to the ends.
    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = choices.length - 1;
      const next =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? index === last
            ? 0
            : index + 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? index === 0
              ? last
              : index - 1
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? last
                : null;
      if (next === null || contextUnknown) {
        return;
      }
      event.preventDefault();
      radios()[next]?.focus();
      onContextChange(choices[next].value);
    };

    const showWidths = !!widths?.length && !gaps.llamaCpp;
    const notes = [
      showWidths && {
        key: 'widths',
        wide:
          widths!.length === 1
            ? `Its attention heads allow ${widths![0]} GPU${widths![0] === 1 ? '' : 's'} only, so only that count is offered.`
            : `Its attention heads split across ${joinOr(widths!)} GPUs, so only those counts are offered.`,
        narrow: `Splits across ${joinOr(widths!)} GPU${widths!.length === 1 && widths![0] === 1 ? '' : 's'} only.`,
      },
      gaps.contextAssumed && {
        key: 'context',
        wide: `Context length unknown, so the estimate assumes ${FALLBACK_CONTEXT_TOKENS.toLocaleString('en-US')} tokens.`,
      },
      gaps.configUnreadable && { key: 'config', wide: 'GPU count not checked: the model’s config couldn’t be read.' },
      gaps.headsUnknown && {
        key: 'heads',
        wide: 'GPU count not checked: the model’s config doesn’t name its attention heads.',
      },
    ].filter((note): note is { key: string; wide: string; narrow?: string } => !!note);

    const renderEstimate = () => {
      if (loading) {
        return (
          <>
            <div aria-hidden className={styles.layouts}>
              {[0, 1, 2, 3].map((i) => (
                <div className={styles.skeleton} key={i} style={{ opacity: 1 - i * 0.22 }} />
              ))}
            </div>
            <div className={styles.status} role="status">
              <CircularProgress size={14} thickness={5} color="inherit" />
              Checking the model’s GPU needs…
            </div>
          </>
        );
      }
      if (!layouts) {
        return gaps.llamaCpp ? (
          <div className={styles.unestimated}>
            <strong>GPU memory not checked</strong>
            <p>
              llama.cpp splits a model across GPUs by layer, so neither the GPU count nor the memory is checked, and
              every environment is shown.
            </p>
          </div>
        ) : (
          <div className={styles.unestimated}>
            <strong>Can’t estimate this model</strong>
            <p>
              Its repo lists no safetensors parameter count, so every environment is shown, whatever its memory. Check
              the model card for its size before you book.
            </p>
          </div>
        );
      }
      return (
        <>
          <ul aria-label="GPU memory needed, per layout" aria-live="polite" className={styles.layouts}>
            {layouts.map((layout, index) => (
              <li className={styles.layoutItem} key={layout.gpus}>
                {index > 0 && (
                  <span aria-hidden className={styles.or}>
                    or
                  </span>
                )}
                <div className={styles.chip}>
                  <div className={styles.chipTop}>
                    <span
                      aria-hidden
                      className={styles.squares}
                      style={{ gridTemplateColumns: `repeat(${Math.min(layout.gpus, 4)}, 6px)` }}
                    >
                      {Array.from({ length: layout.gpus }, (_, i) => (
                        <span key={i} />
                      ))}
                    </span>
                    {layout.gpus === 1 ? '1 GPU' : `${layout.gpus} GPUs`}
                  </div>
                  <div className={styles.chipValue}>{layout.gbPerGpu} GB</div>
                </div>
              </li>
            ))}
          </ul>
          <p className={styles.help}>
            <span className={styles.wide}>
              Per GPU, for the weights plus the context cache. Only environments that can hold one of these layouts are
              listed.
            </span>
            <span className={styles.narrow}>
              Any one layout works. Per GPU, for the weights plus the context cache.
            </span>
          </p>
        </>
      );
    };

    return (
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.columns}>
          <div className={styles.column}>
            <div className={styles.labelRow}>
              <span className={styles.label} id={`${id}-context`}>
                Context length
              </span>
            </div>
            <p className={styles.help} id={`${id}-context-help`}>
              Max tokens per request, input + output.
            </p>
            <div
              aria-describedby={`${id}-context-help`}
              aria-labelledby={`${id}-context`}
              className={cx(styles.choices, highlightContext && styles.highlight)}
              ref={groupRef}
              role="radiogroup"
            >
              {choices.map((choice, index) => {
                const checked = index === checkedIndex;
                return (
                  <button
                    aria-checked={checked}
                    className={cx(styles.choice, checked && styles.checked)}
                    disabled={contextUnknown}
                    key={choice.value}
                    onClick={() => onContextChange(choice.value)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    role="radio"
                    tabIndex={checked ? 0 : -1}
                    type="button"
                  >
                    <span className={styles.choiceText}>
                      {choice.label}
                      {choice.suffix && <span className={styles.suffix}>{choice.suffix}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className={styles.hint}>Carries over to Max context in Config.</p>
          </div>

          <div className={styles.column}>
            <div className={styles.labelRow}>
              <span className={styles.label}>GPU memory needed</span>
              <span className={styles.tag}>Estimate</span>
            </div>
            {renderEstimate()}
          </div>
        </div>

        {notes.length > 0 && (
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={note.key} role="note">
                <InfoOutlinedIcon aria-hidden className={styles.noteIcon} />
                {note.narrow ? (
                  <>
                    <span className={styles.wide}>{note.wide}</span>
                    <span className={styles.narrow}>{note.narrow}</span>
                  </>
                ) : (
                  note.wide
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);

export default CustomModelSizingPanel;

/** Above the environment list: how many environments hold the estimate, at which context. */
export function SizingListHeader({ count, context }: { count: number; context: string }) {
  return (
    <div className={styles.listHeader}>
      <strong>
        {count} environment{count === 1 ? '' : 's'} can hold this model
      </strong>
      <span>at {context} context</span>
    </div>
  );
}

/** In place of the environment list when no environment holds the estimate. */
export function NoFitCard({ context, onChooseShorter }: { context: string; onChooseShorter: () => void }) {
  return (
    <div className={styles.noFit}>
      <strong>No environment can hold this model at {context} context</strong>
      <p>
        The free GPUs are smaller than every layout above. Choose a shorter context, or pick a quantized variant of the
        model.
      </p>
      <button className={styles.shorter} onClick={onChooseShorter} type="button">
        Choose a shorter context ↑
      </button>
    </div>
  );
}

/** "Fits as 1, 2 or 4 GPUs" — the layouts an environment's free GPUs can book, for its card. */
export function FitSummary({ gpuCounts }: { gpuCounts: number[] }) {
  if (gpuCounts.length === 0) {
    return null;
  }
  const last = gpuCounts[gpuCounts.length - 1];
  return (
    <div className={styles.fitSummary}>
      <CheckIcon aria-hidden className={styles.fitIcon} />
      Fits as {joinOr(gpuCounts)} GPU{gpuCounts.length === 1 && last === 1 ? '' : 's'}
    </div>
  );
}
