import cx from 'classnames';
import { CSSProperties, KeyboardEvent, MouseEvent, MouseEventHandler, ReactNode } from 'react';
import styles from './card.module.css';

type Size = 'xs' | 'sm' | 'md' | 'lg';
type Variant =
  | 'glass'
  | 'glass-shaded'
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
  ariaPressed?: boolean;
  children: ReactNode;
  className?: string;
  direction?: 'row' | 'column';
  id?: string;
  innerShadow?: Shadow;
  onClick?: MouseEventHandler<HTMLDivElement>;
  padding?: Size;
  paddingX?: Size;
  paddingY?: Size;
  radius?: Size;
  role?: string;
  shadow?: Shadow;
  spacing?: Size;
  style?: CSSProperties;
  variant?: Variant;
};

const Card: React.FC<CardProps> = ({
  ariaPressed,
  children,
  className,
  direction,
  id,
  innerShadow,
  onClick,
  padding,
  paddingX,
  paddingY,
  radius,
  role,
  shadow,
  spacing,
  style,
  variant,
}) => {
  // Allow keyboard activation when the card acts as a button.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(event as unknown as MouseEvent<HTMLDivElement>);
    }
  };

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
      aria-pressed={ariaPressed}
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
      role={role ?? (onClick ? 'button' : undefined)}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      style={{ boxShadow: shadowStyles.join(', '), ...style }}
    >
      {children}
    </div>
  );
};

export default Card;
