import cx from 'classnames';
import { ReactNode } from 'react';
import styles from './card.module.css';

type Size = 'sm' | 'md' | 'lg';
type Variant =
  | 'glass'
  | 'glass-shaded'
  | 'glass-outline'
  | 'success'
  | 'success-outline'
  | 'warning'
  | 'warning-outline'
  | 'error'
  | 'error-outline'
  | 'accent1'
  | 'accent1-outline'
  | 'accent2'
  | 'accent2-outline';

type Shadow = 'black' | 'accent1' | 'accent2' | 'success' | 'warning' | 'error';

type CardProps = {
  children: ReactNode;
  className?: string;
  direction?: 'row' | 'column';
  id?: string;
  innerShadow?: Shadow;
  padding?: Size;
  paddingX?: Size;
  paddingY?: Size;
  radius?: Size;
  role?: string;
  shadow?: Shadow;
  spacing?: Size;
  variant?: Variant;
};

const Card: React.FC<CardProps> = ({
  children,
  className,
  direction,
  id,
  innerShadow,
  padding,
  paddingX,
  paddingY,
  radius,
  role,
  shadow,
  spacing,
  variant,
}) => {
  let shadowStyles = [];
  if (variant === 'glass-shaded') {
    shadowStyles.push('var(--inner-shadow-glass)');
  }
  if (shadow) {
    shadowStyles.push(`var(--drop-shadow-${shadow})`);
  }
  if (innerShadow) {
    shadowStyles.push(`var(--inner-shadow-${innerShadow})`);
  }

  return (
    <div
      className={cx(
        styles.root,
        {
          [styles[`direction-${direction}`]]: !!direction,
          [styles[`padding-${padding}`]]: !!padding,
          [styles[`paddingX-${paddingX}`]]: !!paddingX,
          [styles[`paddingY-${paddingY}`]]: !!paddingY,
          [styles[`radius-${radius}`]]: !!radius,
          [styles[`spacing-${spacing}`]]: !!spacing,
          [styles[`variant-${variant}`]]: !!variant,
        },
        className
      )}
      id={id}
      role={role}
      style={{ boxShadow: shadowStyles.join(', ') }}
    >
      {children}
    </div>
  );
};

export default Card;
