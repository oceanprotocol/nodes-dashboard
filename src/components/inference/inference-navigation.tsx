import Button from '@/components/button/button';
import Card from '@/components/card/card';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import ModelCard from '@/components/inference/model-card';
import { useInferenceContext } from '@/context/inference-context';
import { HuggingFaceModel } from '@/types/huggingface';
import { formatDuration } from '@/utils/formatters';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { useState } from 'react';
import styles from './inference-navigation.module.css';

type InferenceNavigationProps = {
  /** Prev (back) action — button hidden when not provided. */
  onPrev?: () => void;
  prevLabel?: string;
  /** Next (continue) action — omit for a plain submit button that lets the wrapping form handle it. */
  onNext?: () => void;
  /** Force-show the next button even without onNext (e.g. a form submit button). */
  showNext?: boolean;
  nextButtonHtmlType?: 'button' | 'submit' | 'reset';
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Remove a model from the selection panel — model cards stay read-only when not provided. */
  onRemoveModel?: (model: HuggingFaceModel) => void;
};

const InferenceNavigation: React.FC<InferenceNavigationProps> = ({
  onPrev,
  prevLabel = 'Go back',
  onNext,
  showNext = false,
  nextButtonHtmlType = 'button',
  nextLabel = 'Continue',
  nextDisabled = false,
  onRemoveModel,
}) => {
  const [selectionOpen, setSelectionOpen] = useState(false);
  const { selectedModels, selectedEnv, selectedToken, jobDurationSeconds } = useInferenceContext();

  const hasSelection = selectedModels.length > 0 || !!selectedEnv;

  return (
    <div className={styles.root}>
      <Card className={styles.card} radius="lg" shadow="black" variant="glass-shaded">
        {hasSelection && (
          <Collapse in={selectionOpen} unmountOnExit>
            <Card
              className={styles.panel}
              direction="column"
              paddingX="sm"
              paddingY="xs"
              radius="md"
              innerShadow="black"
              spacing="md"
              variant="glass"
            >
              {selectedModels.length > 0 && (
                <div className={styles.section}>
                  <div>
                    <h4>Models</h4>
                    {onRemoveModel ? <div className="textSecondary">Click on a model to deselect it</div> : null}
                  </div>
                  <div className={styles.grid}>
                    {selectedModels.map((model) => (
                      <ModelCard key={model.id} model={model} onToggle={onRemoveModel} selected={!!onRemoveModel} />
                    ))}
                  </div>
                </div>
              )}

              {selectedEnv && (
                <div className={styles.section}>
                  <div>
                    <h4>Environment</h4>
                    <span className="textSecondary">Running for {formatDuration(jobDurationSeconds)}</span>
                  </div>
                  <InferenceEnvironmentCard
                    defaultToken={selectedToken?.address}
                    durationSeconds={jobDurationSeconds}
                    environment={selectedEnv.environment}
                    nodeInfo={selectedEnv.nodeInfo}
                    selected={false}
                  />
                </div>
              )}
            </Card>
          </Collapse>
        )}
        <div className="actionsGroupMdBetween">
          <div className="actionsGroupMdEnd">
            {onPrev && (
              <Button color="accent1" onClick={onPrev} size="lg" type="button" variant="transparent">
                {prevLabel}
              </Button>
            )}
          </div>
          <div className="actionsGroupMdEnd">
            <Button
              color="accent1"
              contentAfter={<ExpandLessIcon className={cx(styles.chevron, { [styles.chevronOpen]: selectionOpen })} />}
              disabled={!hasSelection}
              onClick={() => setSelectionOpen((prev) => !prev)}
              size="lg"
              type="button"
              variant="transparent"
            >
              Selection
            </Button>
            {(onNext || showNext) && (
              <Button color="accent1" disabled={nextDisabled} onClick={onNext} size="lg" type={nextButtonHtmlType}>
                {nextLabel}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default InferenceNavigation;
