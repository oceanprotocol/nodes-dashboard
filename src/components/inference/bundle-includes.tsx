import { getAuthorAvatarUrl } from '@/services/huggingface-service';
import { AppTemplate, includedRepoId, TemplateIncludedItem } from '@/types/templates';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ModelTrainingOutlinedIcon from '@mui/icons-material/ModelTrainingOutlined';
import cx from 'classnames';
import { useState } from 'react';
import styles from './bundle-includes.module.css';

const KIND_ICON: Record<TemplateIncludedItem['kind'], React.ComponentType<{ className?: string }>> = {
  model: ModelTrainingOutlinedIcon,
  workflow: AccountTreeOutlinedIcon,
  customnode: ExtensionOutlinedIcon,
  other: InsertDriveFileOutlinedIcon,
};

/** Publisher avatar for an included item, falling back to a kind glyph (non-HF items, missing orgs). */
const ItemAvatar: React.FC<{ item: TemplateIncludedItem }> = ({ item }) => {
  const [failed, setFailed] = useState(false);
  const repoId = includedRepoId(item);
  const url = repoId ? getAuthorAvatarUrl(repoId.split('/')[0]) : undefined;
  const Icon = KIND_ICON[item.kind] ?? KIND_ICON.other;
  return (
    <span className={styles.avatar}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" onError={() => setFailed(true)} src={url} />
      ) : (
        <Icon className={styles.avatarIcon} />
      )}
    </span>
  );
};

export const IncludesAvatarCluster: React.FC<{ template: AppTemplate; max?: number }> = ({ template, max = 3 }) => {
  const items = template.includes ?? [];
  if (items.length === 0) {
    return null;
  }
  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;
  return (
    <span className={styles.cluster}>
      {shown.map((item) => (
        <ItemAvatar item={item} key={`${item.kind}-${item.name}`} />
      ))}
      {hidden > 0 && <span className={cx(styles.avatar, styles.clusterMore)}>+{hidden}</span>}
    </span>
  );
};

type BundleIncludesProps = {
  template: AppTemplate;
  /** Compact mode drops sizes and links — for the catalogue card, where space is tight. */
  compact?: boolean;
  /** Cap the rows rendered; the remainder is summarised as "+N more". */
  max?: number;
  /**
   * Render each item's `role` line. Only for a model pack, where the manifest IS the offer — inside a
   * bundle that also ships workflows the list is a footnote and an extra line per row is just weight.
   */
  showRoles?: boolean;
};

/**
 * What a bundle pre-downloads, as published by the node in `includes[]`. Display only — the node
 * neither reads nor verifies this list, so it is only as accurate as the template's own `command`.
 * Items with a Hugging Face repo id link to it and show their publisher's avatar.
 */
const BundleIncludes: React.FC<BundleIncludesProps> = ({ template, compact = false, max, showRoles = false }) => {
  const items = template.includes ?? [];
  if (items.length === 0) {
    return null;
  }
  const shown = max != null ? items.slice(0, max) : items;
  const hidden = items.length - shown.length;

  return (
    <ul className={cx(styles.list, { [styles.listCompact]: compact })}>
      {shown.map((item) => {
        const repoId = includedRepoId(item);
        // Where this item can be inspected: its Hugging Face repo page, else the raw download URL
        // (CivitAI, a mirror, a workflow JSON) — so a non-HF item is reachable too rather than being
        // a name the user can't look up. Compact rows stay plain text: they're inside a clickable
        // catalogue card, where a nested link would fight the card's own click target.
        const href = repoId ? `https://huggingface.co/${repoId}` : item.url;
        const linked = !compact && !!href;
        return (
          <li className={cx(styles.item, { [styles.itemRoomy]: showRoles })} key={`${item.kind}-${item.name}`}>
            <ItemAvatar item={item} />
            <span className={styles.text}>
              {linked ? (
                <a
                  className={cx(styles.name, styles.nameLink)}
                  href={href}
                  rel="noreferrer noopener"
                  target="_blank"
                  title={repoId ? `${item.name} — ${repoId}` : item.name}
                >
                  {item.name}
                </a>
              ) : (
                <span className={styles.name} title={item.name}>
                  {item.name}
                </span>
              )}
              {showRoles && item.role && <span className={styles.role}>{item.role}</span>}
              {/* The repo id stays as plain sub-text — the name above is the link now, and two links
                  to the same page in one row is just noise. */}
              {!compact && repoId && (
                <span className={styles.repo} title={repoId}>
                  {repoId}
                </span>
              )}
            </span>
          </li>
        );
      })}
      {hidden > 0 && <li className={cx(styles.item, styles.more)}>+{hidden} more</li>}
    </ul>
  );
};

export default BundleIncludes;
