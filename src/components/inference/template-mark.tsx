import { templateLogoPair } from '@/components/inference/template-logos';
import { AppTemplate } from '@/types/templates';
import { CSSProperties } from 'react';
import styles from './template-mark.module.css';

type TemplateMarkProps = {
  template: AppTemplate;
  /** Diameter of one mark. The pair overlaps, so the cluster is wider than this. */
  size: number;
  /** Rendered when the template has no published mark at all — a category glyph or a monogram. */
  fallback: React.ReactNode;
};

/**
 * A template's brand mark. A bundle is two things — the app that runs it and the model inside it — so
 * when both have a published mark it wears both, overlapping, the way the includes cluster already
 * shows several publishers. Picking one threw the other away, and which one won depended on whether
 * the id happened to spell the app out: renaming a folder silently changed a template's branding.
 *
 * Circles, not the single tile's rounded square: two overlapping shapes is this app's existing idiom
 * for "several things", and the square stays what one thing looks like. Falls back to that square via
 * the caller when only one mark exists, so nothing changes for a service.
 */
const TemplateMark: React.FC<TemplateMarkProps> = ({ template, size, fallback }) => {
  const { app, model } = templateLogoPair(template);

  if (!app || !model) {
    // One mark or none — the caller's own tile, unchanged.
    return <>{fallback}</>;
  }

  return (
    // Model last, so it sits on top: a bundle is bought for the model, and it is what a returning
    // user scans the grid for.
    <span className={styles.pair} style={{ '--mark-size': `${size}px` } as CSSProperties}>
      {[app, model].map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className={styles.mark} key={src} src={src} />
      ))}
    </span>
  );
};

export default TemplateMark;
