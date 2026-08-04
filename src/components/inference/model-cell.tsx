import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import { useState } from 'react';
import styles from './model-cell.module.css';

type ModelCellProps = {
  // Full HF model id, e.g. "meta-llama/Llama-3.1-8B-Instruct". Author is the part before the slash.
  modelId: string;
};

// Compact table-cell version of ModelCard's header: org avatar + model name with the author/org
// underneath. Falls back to the author's initial when the avatar image is missing.
const ModelCell: React.FC<ModelCellProps> = ({ modelId }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const author = modelId.includes('/') ? modelId.split('/')[0] : undefined;
  const name = getModelShortName(modelId);
  const avatarUrl = author ? getModelAvatarUrl({ id: modelId, author }) : undefined;
  const initial = (author ?? modelId).charAt(0).toUpperCase();

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
        <span className={styles.name} title={modelId}>
          {name}
        </span>
        {author && <span className={styles.author}>{author}</span>}
      </div>
    </div>
  );
};

export default ModelCell;
