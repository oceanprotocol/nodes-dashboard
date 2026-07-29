import GpuIcon from '@/assets/icons/gpu.svg';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import InferenceStepper from '@/components/inference/inference-stepper';
import { ACCENT_HEX, CATEGORY_ICON, templateHardware, visualFor } from '@/components/inference/template-visual';
import SectionTitle from '@/components/section-title/section-title';
import { useInferenceContext } from '@/context/inference-context';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate } from '@/types/templates';
import MemoryIcon from '@mui/icons-material/Memory';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import styles from './templates-page.module.css';

type HardwareFilter = 'all' | 'gpu' | 'cpu';

/**
 * Templates flow entry: pick a ready-made containerized app (ComfyUI, …), then choose an environment
 * and pay. A template is a launch preset (image + ports + command + resources) — distinct from the
 * HF-model flows. Templates are served by the node (getServiceTemplates); see useServiceTemplates.
 */
const TemplatesPage: React.FC = () => {
  const router = useRouter();
  const { setSelectedTemplate, clearSelection, buildSelectionQuery } = useInferenceContext();

  const { templates, loading, error } = useServiceTemplates();
  const [filter, setFilter] = useState<HardwareFilter>('all');

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decorate each template once with its derived visual identity + hardware signal (both derived from
  // the template alone, so this is stable for the fetched list).
  const decorated = useMemo(
    () =>
      templates.map((tpl) => {
        const visual = visualFor(tpl.id);
        return { tpl, visual, hw: templateHardware(tpl), accent: ACCENT_HEX[visual.accent] };
      }),
    [templates]
  );

  const gpuCount = useMemo(() => decorated.filter((d) => d.hw.gpu).length, [decorated]);
  const cpuCount = decorated.length - gpuCount;

  const visible = useMemo(
    () => decorated.filter((d) => (filter === 'all' ? true : filter === 'gpu' ? d.hw.gpu : !d.hw.gpu)),
    [decorated, filter]
  );

  const selectTemplate = (tpl: AppTemplate) => {
    setSelectedTemplate(tpl);
    router.push({
      pathname: `/inference/templates/${encodeURIComponent(tpl.id)}/resources`,
      query: buildSelectionQuery({ templateId: tpl.id }),
    });
  };

  const filterPill = (value: HardwareFilter, label: string) => (
    <button
      aria-pressed={filter === value}
      className={cx(styles.filterPill, { [styles.filterPillActive]: filter === value })}
      onClick={() => setFilter(value)}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle="Launch an app on an Ocean Node"
        contentBetween={<InferenceStepper currentStep="template" flowType={InferenceFlowType.Template} />}
      />
      <div className="pageContentWrapper">
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <div className={styles.headerRow}>
            <div className={styles.headerText}>
              <h3>Pick a template</h3>
              <div className="textSecondary">
                Ready-made containerized apps — pick one, choose an environment, pay and launch.
              </div>
            </div>
            {!loading && decorated.length > 0 && (
              <div className={styles.filters} role="group" aria-label="Filter templates by hardware">
                {filterPill('all', `All ${decorated.length}`)}
                {filterPill('gpu', `GPU ${gpuCount}`)}
                {filterPill('cpu', `CPU ${cpuCount}`)}
              </div>
            )}
          </div>

          {loading ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>Loading templates…</div>
          ) : error ? (
            <div className={cx(styles.stateBox, 'textAccent1')}>{error}</div>
          ) : decorated.length === 0 ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>No templates available.</div>
          ) : visible.length === 0 ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>No templates match this filter.</div>
          ) : (
            <div className={styles.grid}>
              {visible.map(({ tpl, visual, hw, accent }) => {
                const name = tpl.name ?? tpl.id;
                const CategoryIcon = CATEGORY_ICON[visual.cat];
                return (
                  <button
                    aria-label={`${name} — ${visual.label}, ${hw.gpu ? 'GPU required' : 'CPU only'}`}
                    className={styles.card}
                    key={tpl.id}
                    onClick={() => selectTemplate(tpl)}
                    style={{ '--accent': accent } as CSSProperties}
                    type="button"
                  >
                    <div className={styles.cardTop}>
                      <span className={styles.mark}>
                        <CategoryIcon className={styles.markIcon} />
                      </span>
                      <span className={styles.titleWrap}>
                        <span className={styles.name} title={name}>
                          {name}
                        </span>
                        <span className={styles.category}>{visual.label}</span>
                      </span>
                    </div>

                    <p className={styles.desc}>
                      {tpl.description || 'No description provided by the template author.'}
                    </p>

                    <div className={styles.footer}>
                      <span className={cx(styles.hw, hw.gpu ? styles.hwGpu : styles.hwCpu)}>
                        {hw.gpu ? <GpuIcon className={styles.hwIcon} /> : <MemoryIcon className={styles.hwIcon} />}
                        {hw.gpu ? 'GPU' : 'CPU'}
                      </span>
                      {hw.ram != null && <span className={styles.chip}>{hw.ram} GB RAM</span>}
                      {hw.disk != null && <span className={styles.chip}>{hw.disk} GB disk</span>}
                      {hw.ram == null && hw.disk == null && <span className={styles.chip}>Resources at next step</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Container>
  );
};

export default TemplatesPage;
