import Card from '@/components/card/card';
import HardwareLabel from '@/components/hardware-label/hardware-label';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { InferencePackage } from '@/types/inference';
import ViewStreamOutlinedIcon from '@mui/icons-material/ViewStreamOutlined';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './package-card.module.css';

function prettyPipeline(tag?: string): string {
  if (!tag) {
    return 'Other';
  }
  return tag
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type PackageCardProps = {
  pkg: InferencePackage;
  selected?: boolean;
  onToggle?: (pkg: InferencePackage) => void;
};

/** Quick-start package tile: same shape as ModelCard, with the bundle's hardware/engine specs. */
const PackageCard: React.FC<PackageCardProps> = ({ pkg, selected = false, onToggle }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { model, env, params } = pkg;
  const avatarUrl = getModelAvatarUrl(model);
  const modelName = getModelShortName(model.id);
  const initial = (model.author ?? model.id).charAt(0).toUpperCase();

  // Pinned GPU booking, one entry per type: "2x <logo> H200". Zero-count types skipped.
  const gpuEntries = Object.entries(env.gpuSelection).filter(([, count]) => count > 0);

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
      <div className={styles.chips}>
        <span className={classNames('chip', 'chipGlass', styles.chip)}>{prettyPipeline(model.pipelineTag)}</span>
        {params.toolCalling && <span className={classNames('chip', 'chipAccent2', styles.chip)}>Tools</span>}
      </div>
      <div className={styles.stats}>
        {gpuEntries.length > 0 ? (
          gpuEntries.map(([description, count]) => (
            <span className={styles.statItem} key={description} title="GPUs">
              {count}x
              <HardwareLabel type="gpu" value={description} />
            </span>
          ))
        ) : (
          <span className={styles.statItem} title="GPUs">
            GPU
          </span>
        )}
        {params.maxContext !== null && (
          <span className={styles.statItem} title="Context length">
            <ViewStreamOutlinedIcon fontSize="small" />
            {Math.round(params.maxContext / 1024)}k ctx
          </span>
        )}
      </div>
    </Card>
  );
};

export default PackageCard;
