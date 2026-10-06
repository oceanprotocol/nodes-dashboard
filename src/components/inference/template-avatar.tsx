import { templateLogo } from '@/components/inference/template-logos';
import TemplateMark from '@/components/inference/template-mark';
import { accentVars, visualFor } from '@/components/inference/template-visual';
import { useTheme } from '@/lib/use-theme';
import { AppTemplate } from '@/types/templates';
import classNames from 'classnames';
import { CSSProperties } from 'react';
import styles from './template-avatar.module.css';

type TemplateAvatarProps = {
  className?: string;
  /** Side of the single-mark tile, in px. A bundle's overlapping pair is drawn slightly smaller. */
  size: number;
  template: AppTemplate;
};

/**
 * A template's avatar as the catalogue shows it: both brand marks of a bundle, overlapping, else one
 * mark, monogram or category glyph on a tile in the category colour.
 */
const TemplateAvatar: React.FC<TemplateAvatarProps> = ({ className, size, template }) => {
  const { resolvedTheme } = useTheme();
  const visual = visualFor(template.id, template.category);
  const logo = templateLogo(template);
  const style = { ...accentVars(visual.meta.accent, resolvedTheme), '--avatar-size': `${size}px` } as CSSProperties;

  return (
    <span className={classNames(styles.root, className)} style={style}>
      <TemplateMark
        fallback={
          <span className={styles.tile}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className={styles.logo} src={logo} />
            ) : visual.mono ? (
              <span className={styles.mono}>{visual.mono}</span>
            ) : (
              <visual.meta.Icon className={styles.icon} />
            )}
          </span>
        }
        size={Math.round((size * 0.8) / 2) * 2}
        template={template}
      />
    </span>
  );
};

export default TemplateAvatar;
