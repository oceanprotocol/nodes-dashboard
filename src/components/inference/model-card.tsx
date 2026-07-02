import Card from '@/components/card/card';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { HuggingFaceModel } from '@/types/huggingface';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckIcon from '@mui/icons-material/Check';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import classNames from 'classnames';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import styles from './model-card.module.css';

function formatCompact(value?: number): string {
  if (value === undefined || value === null) {
    return '—';
  }
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatUpdated(lastModified?: string): string {
  if (!lastModified) {
    return 'Unknown';
  }
  const date = new Date(lastModified);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function prettyPipeline(tag?: string): string {
  if (!tag) {
    return 'Other';
  }
  return tag
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type ModelCardProps = {
  model: HuggingFaceModel;
  selected?: boolean;
  onToggle?: (model: HuggingFaceModel) => void;
};

const ModelCard: React.FC<ModelCardProps> = ({ model, selected = false, onToggle }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = getModelAvatarUrl(model);
  const modelName = getModelShortName(model.id);
  const initial = (model.author ?? model.id).charAt(0).toUpperCase();

  return (
    <Card
      ariaPressed={onToggle ? selected : undefined}
      className={classNames(styles.card, { [styles.selectable]: !!onToggle, [styles.selected]: selected })}
      direction="column"
      innerShadow="black"
      onClick={onToggle ? () => onToggle(model) : undefined}
      padding="sm"
      radius="md"
      spacing="sm"
      variant="glass-shaded"
    >
      {selected && (
        <span className={styles.check}>
          <CheckIcon fontSize="small" />
        </span>
      )}
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
        {model.gated && <span className={classNames('chip', 'chipWarning', styles.chip)}>Gated</span>}
      </div>
      <div className={styles.stats}>
        <span className={styles.statItem} title={`Updated ${formatUpdated(model.lastModified)}`}>
          <AccessTimeIcon fontSize="small" />
          {formatUpdated(model.lastModified)}
        </span>
        <span className={styles.statItem} title="Downloads">
          <FileDownloadOutlinedIcon fontSize="small" />
          {formatCompact(model.downloads)}
        </span>
        <span className={styles.statItem} title="Likes">
          <FavoriteBorderIcon fontSize="small" />
          {formatCompact(model.likes)}
        </span>
      </div>
    </Card>
  );
};

export default ModelCard;
