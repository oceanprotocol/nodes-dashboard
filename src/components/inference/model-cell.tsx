import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { useState } from 'react';
import styles from './model-cell.module.css';

type ModelCellProps = {
  // Full HF model id, e.g. "meta-llama/Llama-3.1-8B-Instruct". Author is the part before the slash.
  modelId?: string;
  // Template-launched services have no HF model — the app is named directly instead. `title` wins
  // over `modelId` when both are given, and the avatar falls back to the title's initial.
  title?: string;
  subtitle?: string;
};

// Compact table-cell version of ModelCard's header: org avatar + model name with the author/org
// underneath. Falls back to the author's initial when the avatar image is missing.
const ModelCell: React.FC<ModelCellProps> = ({ modelId, title, subtitle }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const author = modelId?.includes('/') ? modelId.split('/')[0] : undefined;
  const name = title ?? (modelId ? getModelShortName(modelId) : '-');
  const caption = title ? subtitle : author;
  const avatarUrl = !title && author && modelId ? getModelAvatarUrl({ id: modelId, author }) : undefined;
  const initial = (title ?? author ?? modelId ?? '?').charAt(0).toUpperCase();

  return (
    <div className={styles.cell}>
      <div className={styles.avatar}>
        {avatarUrl && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={author ?? name} onError={() => setAvatarFailed(true)} src={avatarUrl} />
        ) : (
          <span>{initial}</span>
        )}
      </div>
      <div className={styles.titleBox}>
        <span className={styles.name} title={title ?? modelId}>
          {name}
        </span>
        {caption && (
          <span className={styles.author} title={caption}>
            {caption}
          </span>
        )}
      </div>
    </div>
  );
};

export default ModelCell;
