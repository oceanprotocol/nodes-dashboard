import Card from '@/components/card/card';
import Container from '@/components/container/container';
import InferenceStepper from '@/components/inference/inference-stepper';
import SectionTitle from '@/components/section-title/section-title';
import useServiceTemplates from '@/components/hooks/use-service-templates';
import { useInferenceContext } from '@/context/inference-context';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate } from '@/types/templates';
import cx from 'classnames';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import styles from './templates-page.module.css';

/**
 * Templates flow entry: pick a ready-made containerized app (ComfyUI, …), then choose an environment
 * and pay. A template is a launch preset (image + ports + command + resources) — distinct from the
 * HF-model flows. Templates are served by the node (getServiceTemplates); see useServiceTemplates.
 */
const TemplatesPage: React.FC = () => {
  const router = useRouter();
  const { setSelectedTemplate, clearSelection, buildSelectionQuery } = useInferenceContext();

  const { templates, loading } = useServiceTemplates();

  // Always start fresh (new entry or Back-nav from a later step): clear leftover selection once, on mount.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTemplate = (tpl: AppTemplate) => {
    setSelectedTemplate(tpl);
    router.push({
      pathname: `/inference/templates/${encodeURIComponent(tpl.id)}/resources`,
      query: buildSelectionQuery({ templateId: tpl.id }),
    });
  };

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
          <h3>Pick a template</h3>
          <div>Ready-made containerized apps — pick one, choose an environment, pay and launch.</div>
          {loading ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>Loading templates…</div>
          ) : templates.length === 0 ? (
            <div className={cx(styles.stateBox, 'textSecondary')}>No templates available.</div>
          ) : (
            <div className={styles.grid}>
              {templates.map((tpl) => (
                <Card
                  className={styles.card}
                  direction="column"
                  innerShadow="black"
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl)}
                  padding="sm"
                  radius="md"
                  spacing="sm"
                  variant="glass-shaded"
                >
                  <div className={styles.name} title={tpl.name ?? tpl.id}>
                    {tpl.name ?? tpl.id}
                  </div>
                  {tpl.description && <div className={cx(styles.description, 'textSecondary')}>{tpl.description}</div>}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Container>
  );
};

export default TemplatesPage;
