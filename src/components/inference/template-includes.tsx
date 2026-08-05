import { getAuthorAvatarUrl } from '@/services/huggingface-service';
import { AppTemplate, includedRepoId, includedSizeGb, TemplateIncludedItem } from '@/types/templates';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import ModelTrainingOutlinedIcon from '@mui/icons-material/ModelTrainingOutlined';
import cx from 'classnames';
import { useState } from 'react';
import styles from './template-includes.module.css';

const KIND_ICON: Record<TemplateIncludedItem['kind'], React.ComponentType<{ className?: string }>> = {
  model: ModelTrainingOutlinedIcon,
  workflow: AccountTreeOutlinedIcon,
  customnode: ExtensionOutlinedIcon,
  other: InsertDriveFileOutlinedIcon,
};

/** "3 models · 11.5 GB" — the one-line summary of what a bundle brings, for cards and section heads. */
export function includesSummary(tpl: AppTemplate): string | null {
  const items = tpl.includes ?? [];
  if (items.length === 0) {
    return null;
  }
  const models = items.filter((i) => i.kind === 'model').length;
  const noun = models > 0 ? (models === 1 ? 'model' : 'models') : items.length === 1 ? 'item' : 'items';
  const count = models > 0 ? models : items.length;
  const size = includedSizeGb(tpl);
  return size != null ? `${count} ${noun} · ${size.toFixed(1)} GB` : `${count} ${noun}`;
}

/**
 * Rough download time for a bundle's contents. Deliberately a wide, pessimistic band rather than a
 * single number: the real rate depends on the node's uplink and Hugging Face's CDN, and a number that
 * reads as a promise is worse than an obvious estimate. ~25 MB/s is what the compute nodes we've
 * measured sustain with aria2c's 8 connections.
 */
export function estimatedSetupMinutes(tpl: AppTemplate): number | null {
  const size = includedSizeGb(tpl);
  if (size == null || size <= 0) {
    return null;
  }
  return Math.max(1, Math.round((size * 1024) / 25 / 60));
}

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

type TemplateIncludesProps = {
  template: AppTemplate;
  /** Compact mode drops sizes and links — for the catalogue card, where space is tight. */
  compact?: boolean;
  /** Cap the rows rendered; the remainder is summarised as "+N more". */
  max?: number;
};

/**
 * What a bundle pre-downloads, as published by the node in `includes[]`. Display only — the node
 * neither reads nor verifies this list, so it is only as accurate as the template's own `command`.
 * Items with a Hugging Face repo id link to it and show their publisher's avatar.
 */
const TemplateIncludes: React.FC<TemplateIncludesProps> = ({ template, compact = false, max }) => {
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
          <li className={styles.item} key={`${item.kind}-${item.name}`}>
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
              {/* The repo id stays as plain sub-text — the name above is the link now, and two links
                  to the same page in one row is just noise. */}
              {!compact && repoId && (
                <span className={styles.repo} title={repoId}>
                  {repoId}
                </span>
              )}
            </span>
            {!compact && item.sizeGb != null && <span className={styles.size}>{item.sizeGb} GB</span>}
          </li>
        );
      })}
      {hidden > 0 && <li className={cx(styles.item, styles.more)}>+{hidden} more</li>}
    </ul>
  );
};

export default TemplateIncludes;
