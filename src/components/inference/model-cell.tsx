import { templateLogoForName } from '@/components/inference/template-logos';
import { getModelAvatarUrl, getModelShortName } from '@/services/huggingface-service';
import cx from 'classnames';
import { useState } from 'react';
import styles from './model-cell.module.css';

type ModelCellProps = {
  // Full HF model id, e.g. "meta-llama/Llama-3.1-8B-Instruct". Author is the part before the slash.
  modelId?: string;
  // Template-launched services have no HF model — the app is named directly instead. `title` wins
  // over `modelId` when both are given, and the avatar falls back to the title's initial.
  title?: string;
  subtitle?: string;
  // The name isn't known yet (e.g. a service whose template match is still in flight) — shimmer in
  // the cell's own shape so nothing jumps when the real name lands.
  loading?: boolean;
};

// Compact table-cell version of ModelCard's header: org avatar + model name with the author/org
// underneath. Falls back to the author's initial when the avatar image is missing.
const ModelCell: React.FC<ModelCellProps> = ({ modelId, title, subtitle, loading }) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const author = modelId?.includes('/') ? modelId.split('/')[0] : undefined;
  const name = title ?? (modelId ? getModelShortName(modelId) : '-');
  const caption = title ? subtitle : author;
  // A `title` names an app rather than an HF model, so its mark comes from the template logo manifest
  // (null when no file was supplied for it — then the monogram stands in, as for an unknown model).
  const logoSrc = title ? templateLogoForName(title) : null;
  const avatarUrl = logoSrc ?? (!title && author && modelId ? getModelAvatarUrl({ id: modelId, author }) : undefined);
  const initial = (title ?? author ?? modelId ?? '?').charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className={styles.cell}>
        <div className={cx(styles.avatar, styles.skeletonAvatar, 'shimmer')} />
        <div className={cx(styles.titleBox, styles.skeletonBox)}>
          <span className={cx(styles.skeletonName, 'shimmer')} />
          <span className={cx(styles.skeletonAuthor, 'shimmer', 'shimmerSoft')} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cell}>
      <div className={styles.avatar}>
        {avatarUrl && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={author ?? name}
            className={cx({ [styles.logo]: !!logoSrc })}
            onError={() => setAvatarFailed(true)}
            src={avatarUrl}
          />
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
