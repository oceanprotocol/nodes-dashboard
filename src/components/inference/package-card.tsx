import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { InferencePackage } from '@/types/inference';
import { formatPipelineTag } from '@/utils/formatters';
import ViewStreamOutlinedIcon from '@mui/icons-material/ViewStreamOutlined';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './package-card.module.css';

type PackageCardProps = {
  pkg: InferencePackage;
  selected?: boolean;
  onToggle?: (pkg: InferencePackage) => void;
};

/** Quick-start package tile: same shape as ModelCard, with the bundle's hardware/engine specs. */
const PackageCard: React.FC<PackageCardProps> = ({ pkg, selected = false, onToggle }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { model, params, requiredResources, description } = pkg;
  const avatarUrl = getModelAvatarUrl(model);
  const modelName = getModelShortName(model.id);
  const initial = (model.author ?? model.id).charAt(0).toUpperCase();

  // GPU footprint the package targets. The concrete GPU model isn't known until an env is picked in
  // the modal, so the card shows the recommended unit count against a generic "GPU" label.
  const gpuCount = requiredResources.find((r) => r.type === 'gpu')?.recommended ?? 0;

  // Engine-specific chips: vLLM exposes tool calling + a context ceiling; llama.cpp shows its context.
  const showToolChip = params.engine === 'vllm' && params.toolCalling;
  const contextTokens = params.engine === 'vllm' ? params.maxContext : params.contextLength;
  const engineLabel = params.engine === 'llamacpp' ? 'llama.cpp' : 'vLLM';

  return (
    <Card
      ariaPressed={onToggle ? selected : undefined}
      className={classNames(styles.card, { [styles.selectable]: !!onToggle, [styles.selected]: selected })}
      direction="column"
      innerShadow="black"
      onClick={onToggle ? () => onToggle(pkg) : undefined}
      padding="sm"
      radius="md"
      spacing="sm"
      variant={selected ? 'accent2' : 'glass-shaded'}
    >
      <div className={styles.header}>
        <div className={styles.avatar}>
          {avatarUrl && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={model.author ?? modelName} onError={() => setAvatarFailed(true)} src={avatarUrl} />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div className={styles.titleBox}>
          <div className={styles.name} title={modelName}>
            {modelName}
          </div>
          {model.author && <div className={styles.author}>{model.author}</div>}
        </div>
      </div>
      {description && (
        <p className={styles.description} title={description}>
          {description}
        </p>
      )}
      <div className={styles.chips}>
        <span className={classNames('chip', 'chipGlass', styles.chip)}>{formatPipelineTag(model.pipelineTag, 'Other')}</span>
        <span className={classNames('chip', 'chipGlass', styles.chip)}>{engineLabel}</span>
        {showToolChip && <span className={classNames('chip', 'chipAccent2', styles.chip)}>Tools</span>}
      </div>
      <div className={styles.stats}>
        <span className={styles.statItem} title="GPUs">
          {gpuCount > 0 && `${gpuCount}x`}
          <HardwareLabel type="gpu" value="GPU" />
        </span>
        {contextTokens != null && (
          <span className={styles.statItem} title="Context length">
            <ViewStreamOutlinedIcon fontSize="small" />
            {Math.round(contextTokens / 1024)}k ctx
          </span>
        )}
      </div>
    </Card>
  );
};

export default PackageCard;
