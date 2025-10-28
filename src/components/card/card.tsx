import cx from 'classnames';
import { ReactNode } from 'react';
import styles from './card.module.css';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'glass' | 'glass-shaded' | 'glass-outline' | 'success' | 'warning' | 'error';

type CardProps = {
  children: ReactNode;
  className?: string;
  direction?: 'row' | 'column';
  padding?: Size;
  paddingX?: Size;
  paddingY?: Size;
  radius?: Size;
  spacing?: Size;
  variant?: Variant;
};

const Card = ({
  children,
  className,
  direction = 'column',
  padding,
  paddingX,
  paddingY,
  radius,
  spacing,
  variant,
}: CardProps) => (
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
  >
    {children}
  </div>
);

export default Card;
